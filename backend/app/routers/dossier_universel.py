"""Parcours universel : un seul tunnel pour tous les types de visa.

Endpoints :
  POST /api/dossier-universel/creer                  -> crée un dossier + checklist
  GET  /api/dossier-universel/mine                   -> dossiers de l'utilisateur
  GET  /api/dossier-universel/{id}                   -> dossier + pièces + progression
  GET  /api/dossier-universel/{id}/checklist         -> checklist enrichie (méta + statut)
  POST /api/dossier-universel/{id}/upload            -> upload + analyse IA d'une pièce
  POST /api/dossier-universel/{id}/coherence         -> analyse de cohérence inter-docs
  GET  /api/dossier-universel/{id}/risque            -> profil de risque consulaire
  GET  /api/dossier-universel/{id}/date-depot        -> date optimale de dépôt
  POST /api/dossier-universel/{id}/astuce            -> astuces pour une pièce
"""

from __future__ import annotations

import os
import uuid
from datetime import date, timedelta

import anthropic
from fastapi import APIRouter, File, Form, Header, HTTPException, UploadFile
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase
from app.services import (
    analyse_coherence,
    checklist_officielle,
    cinetpay,
    document_analyzer,
    profil_risque,
)

router = APIRouter()

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

BUCKET = "dossier-documents"
MAX_FILE_SIZE = 5 * 1024 * 1024
_ALLOWED_CT = {"application/pdf", "image/jpeg", "image/jpg", "image/png"}

# Pièce de checklist -> type reconnu par document_analyzer (sinon analyse générique).
_ANALYZER_MAP = {
    "passeport": "PASSEPORT",
    "photo_identite": "PHOTO_IDENTITE",
    "releve_bancaire": "RELEVE_BANCAIRE",
    "assurance_voyage": "ASSURANCE_VOYAGE",
    "billet_avion": "RESERVATION_VOL",
    "billet_continuation": "RESERVATION_VOL",
    "justificatif_hebergement": "RESERVATION_HOTEL",
    "justificatif_professionnel": "JUSTIFICATIF_PRO",
    "lettre_motivation": "LETTRE_MOTIVATION",
    "diplomes": "DIPLOME",
    "attestation_inscription": "ATTESTATION_SCOLARITE",
    "lien_parente": "ACTE_NAISSANCE",
    "attestation_accueil": "INVITATION_FAMILLE",
    "invitation_entreprise": "INVITATION_ENTREPRISE",
    "ordre_mission": "ATTESTATION_TRAVAIL",
    "certificat_medical": "CERTIFICAT_MEDICAL",
    "preuve_financement_soins": "RELEVE_BANCAIRE",
    "acte_mariage": "CERTIFICAT_MARIAGE",
}

_STATUT_MAP = {"VALIDE": "valide", "ATTENTION": "incomplet", "PROBLEME": "probleme"}


# ---------------------------------------------------------------------------
# Modèles
# ---------------------------------------------------------------------------
class CreerRequest(BaseModel):
    type_visa: str
    pays_destination: str
    pays_origine: str
    # Profil du demandeur (âge, situation familiale, propriétaire, historique
    # de voyage, statut emploi) — alimente le profil de risque consulaire.
    profil: dict | None = None
    # Bénéficiaire du dossier (soi-même ou un proche).
    beneficiaire_type: str = "moi-meme"
    beneficiaire_prenom: str | None = None
    beneficiaire_lien: str | None = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _get_dossier(dossier_id: str) -> dict:
    supabase = get_supabase()
    r = (
        supabase.table("dossiers_universels")
        .select("*")
        .eq("id", dossier_id)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Dossier introuvable.")
    return r.data[0]


def _pieces(dossier_id: str) -> list[dict]:
    supabase = get_supabase()
    r = (
        supabase.table("dossier_pieces")
        .select("*")
        .eq("dossier_id", dossier_id)
        .order("created_at", desc=False)
        .execute()
    )
    return r.data or []


def _recompute_score(dossier_id: str, pieces: list[dict] | None = None) -> int:
    pieces = pieces if pieces is not None else _pieces(dossier_id)
    obligatoires = [p for p in pieces if p["obligatoire"]]
    total = len(obligatoires)
    valides = len([p for p in obligatoires if p["statut"] == "valide"])
    score = round(valides / total * 100) if total else 0
    get_supabase().table("dossiers_universels").update(
        {"score_global": score, "updated_at": "now()"}
    ).eq("id", dossier_id).execute()
    return score


def _serialize_piece(p: dict) -> dict:
    return {
        "id": str(p["id"]),
        "type_document": p["type_document"],
        "label": p["label"],
        "obligatoire": p["obligatoire"],
        "statut": p["statut"],
        "note": p.get("note"),
        "feedback_ia": p.get("feedback_ia"),
        "suggestions": p.get("suggestions") or [],
    }


def _content_type(filename: str, fallback: str) -> str:
    ext = os.path.splitext(filename)[1].lower()
    return {
        ".pdf": "application/pdf",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
    }.get(ext, fallback)


# ---------------------------------------------------------------------------
# Création / lecture
# ---------------------------------------------------------------------------
@router.post("/creer")
def creer(
    payload: CreerRequest,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict:
    supabase = get_supabase()
    dossier = {
        "type_visa": payload.type_visa,
        "pays_destination": payload.pays_destination,
        "pays_origine": payload.pays_origine,
        "user_id": x_user_id,
    }
    res = supabase.table("dossiers_universels").insert(dossier).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Dossier non créé.")
    dossier_id = res.data[0]["id"]

    # Stocke profil + bénéficiaire séparément (robuste si les colonnes n'ont pas
    # encore été ajoutées à une base existante).
    meta: dict = {
        "beneficiaire_type": payload.beneficiaire_type,
        "beneficiaire_prenom": payload.beneficiaire_prenom,
        "beneficiaire_lien": payload.beneficiaire_lien,
    }
    if payload.profil:
        meta["profil_demandeur"] = payload.profil
    try:
        supabase.table("dossiers_universels").update(meta).eq("id", dossier_id).execute()
    except Exception:  # noqa: BLE001 — colonnes absentes : on ignore
        pass

    checklist = checklist_officielle.get_checklist(
        payload.type_visa, payload.pays_destination
    )
    pieces = [
        {
            "dossier_id": dossier_id,
            "type_document": item["id"],
            "label": item["label"],
            "obligatoire": item["obligatoire"],
            "statut": "a_fournir",
        }
        for item in checklist
    ]
    if pieces:
        supabase.table("dossier_pieces").insert(pieces).execute()

    return {"dossier_id": str(dossier_id)}


@router.get("/mine")
def mine(x_user_id: str | None = Header(default=None, alias="X-User-Id")) -> dict:
    if not x_user_id:
        return {"dossiers": []}
    supabase = get_supabase()
    r = (
        supabase.table("dossiers_universels")
        .select("*")
        .eq("user_id", x_user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"dossiers": r.data or []}


@router.get("/{dossier_id}")
def get_dossier(dossier_id: str) -> dict:
    dossier = _get_dossier(dossier_id)
    pieces = _pieces(dossier_id)
    obligatoires = [p for p in pieces if p["obligatoire"]]
    valides = len([p for p in obligatoires if p["statut"] == "valide"])
    return {
        "id": str(dossier["id"]),
        "type_visa": dossier["type_visa"],
        "pays_destination": dossier["pays_destination"],
        "pays_origine": dossier["pays_origine"],
        "statut": dossier["statut"],
        "score_global": dossier.get("score_global", 0),
        "score_coherence": dossier.get("score_coherence"),
        "beneficiaire_type": dossier.get("beneficiaire_type", "moi-meme"),
        "beneficiaire_prenom": dossier.get("beneficiaire_prenom"),
        "beneficiaire_lien": dossier.get("beneficiaire_lien"),
        "statut_paiement": dossier.get("statut_paiement", "gratuit"),
        "plan": dossier.get("plan", "diagnostic"),
        "montant_paye": dossier.get("montant_paye", 0),
        "documents_total": len(obligatoires),
        "documents_valides": valides,
        "pieces": [_serialize_piece(p) for p in pieces],
    }


@router.get("/{dossier_id}/checklist")
def checklist(dossier_id: str) -> dict:
    dossier = _get_dossier(dossier_id)
    items = checklist_officielle.get_checklist(
        dossier["type_visa"], dossier["pays_destination"]
    )
    pieces_by_type = {p["type_document"]: p for p in _pieces(dossier_id)}

    enriched = []
    for item in items:
        piece = pieces_by_type.get(item["id"], {})
        enriched.append(
            {
                **item,
                "statut": piece.get("statut", "a_fournir"),
                "note": piece.get("note"),
                "feedback_ia": piece.get("feedback_ia"),
                "suggestions": piece.get("suggestions") or [],
            }
        )
    return {"checklist": enriched}


# ---------------------------------------------------------------------------
# Upload + analyse IA
# ---------------------------------------------------------------------------
@router.post("/{dossier_id}/upload")
async def upload(
    dossier_id: str,
    type_document: str = Form(...),
    file: UploadFile = File(...),
) -> dict:
    dossier = _get_dossier(dossier_id)
    supabase = get_supabase()

    piece_res = (
        supabase.table("dossier_pieces")
        .select("*")
        .eq("dossier_id", dossier_id)
        .eq("type_document", type_document)
        .limit(1)
        .execute()
    )
    if not piece_res.data:
        raise HTTPException(status_code=404, detail="Pièce inconnue pour ce dossier.")
    piece = piece_res.data[0]

    content_type = (file.content_type or "").lower()
    if content_type not in _ALLOWED_CT:
        raise HTTPException(status_code=422, detail="Format non supporté (PDF, JPG, PNG).")
    content = await file.read()
    if not content:
        raise HTTPException(status_code=422, detail="Fichier vide.")
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 5 Mo).")

    safe = os.path.basename(file.filename or "document")
    storage_path = f"{dossier_id}/{type_document}_{uuid.uuid4().hex[:8]}_{safe}"
    try:
        supabase.storage.from_(BUCKET).upload(
            storage_path, content, {"content-type": content_type, "upsert": "true"}
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=502, detail=f"Échec de l'upload : {exc}") from exc

    analyzer_type = _ANALYZER_MAP.get(type_document, piece["label"])
    verdict = document_analyzer.analyze_document(
        doc_type=analyzer_type,
        file_bytes=content,
        content_type=_content_type(safe, content_type),
        context={
            "country": dossier["pays_origine"],
            "destination": dossier["pays_destination"],
            "visa_type": dossier["type_visa"],
        },
    )

    statut = _STATUT_MAP.get(verdict["status"], "incomplet")
    updated = (
        supabase.table("dossier_pieces")
        .update(
            {
                "statut": statut,
                "storage_path": storage_path,
                "feedback_ia": verdict["feedback"],
                "suggestions": verdict["suggestions"],
                "note": verdict["note"],
                "updated_at": "now()",
            }
        )
        .eq("id", piece["id"])
        .execute()
    )
    if not updated.data:
        raise HTTPException(status_code=500, detail="Mise à jour de la pièce échouée.")

    score = _recompute_score(dossier_id)
    return {"piece": _serialize_piece(updated.data[0]), "score_global": score}


# ---------------------------------------------------------------------------
# Analyse de cohérence inter-documents (verdict consulaire)
# ---------------------------------------------------------------------------
class CoherenceRequest(BaseModel):
    dossier_id: str


def _persist_coherence(dossier_id: str, r: dict) -> None:
    """Enregistre l'analyse (robuste si les colonnes verdict ne sont pas créées)."""
    supabase = get_supabase()
    base = {
        "dossier_id": dossier_id,
        "score_coherence": r["score_coherence"],
        "niveau": r["niveau"],
        "incoherences_critiques": r["incoherences_critiques"],
        "points_vigilance": r["points_vigilance"],
        "points_forts": r["points_forts"],
        "recommandations": r["recommandations_prioritaires"],
    }
    extra = {
        "verdict_consul": r["verdict_consul"],
        "probabilite_accord": r["probabilite_accord"],
        "resume_consul": r["resume_consul"],
    }
    try:
        supabase.table("analyses_coherence").insert({**base, **extra}).execute()
    except Exception:  # noqa: BLE001 — colonnes verdict non créées : repli
        try:
            supabase.table("analyses_coherence").insert(base).execute()
        except Exception:  # noqa: BLE001
            pass


@router.post("/coherence")
def lancer_coherence(payload: CoherenceRequest) -> dict:
    """Lance l'analyse de cohérence inter-documents (verdict consulaire simulé)."""
    dossier = _get_dossier(payload.dossier_id)
    supabase = get_supabase()
    uploaded = [
        p
        for p in _pieces(payload.dossier_id)
        if p["statut"] in ("valide", "incomplet", "probleme")
    ]
    if len(uploaded) < 2:
        return {
            "pret": False,
            "message": "Uploadez au moins 2 documents pour lancer l'analyse de cohérence.",
        }

    # Extraction paresseuse des données structurées (mise en cache par pièce).
    for p in uploaded:
        de = p.get("donnees_extraites")
        if not isinstance(de, dict) or "dates" not in de:
            donnees = analyse_coherence.extraire_donnees_document(
                p["type_document"],
                p.get("feedback_ia") or "",
                p.get("storage_path") or "",
            )
            supabase.table("dossier_pieces").update(
                {"donnees_extraites": donnees}
            ).eq("id", p["id"]).execute()
            p["donnees_extraites"] = donnees

    try:
        result = analyse_coherence.analyser_coherence_globale(
            uploaded,
            dossier["type_visa"],
            dossier["pays_destination"],
            dossier["pays_origine"],
            profil=dossier.get("profil_demandeur"),
        )
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if result.get("pret"):
        _persist_coherence(payload.dossier_id, result)
        supabase.table("dossiers_universels").update(
            {"score_coherence": result["score_coherence"], "updated_at": "now()"}
        ).eq("id", payload.dossier_id).execute()

    return result


@router.get("/coherence/{dossier_id}")
def get_coherence(dossier_id: str) -> dict:
    """Récupère la dernière analyse de cohérence enregistrée."""
    supabase = get_supabase()
    r = (
        supabase.table("analyses_coherence")
        .select("*")
        .eq("dossier_id", dossier_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    if not r.data:
        return {"pret": False, "message": "Aucune analyse disponible."}
    row = r.data[0]
    return {
        "pret": True,
        "score_coherence": row.get("score_coherence"),
        "niveau": row.get("niveau"),
        "resume_consul": row.get("resume_consul"),
        "incoherences_critiques": row.get("incoherences_critiques") or [],
        "points_vigilance": row.get("points_vigilance") or [],
        "points_forts": row.get("points_forts") or [],
        "recommandations_prioritaires": row.get("recommandations") or [],
        "verdict_consul": row.get("verdict_consul"),
        "probabilite_accord": row.get("probabilite_accord"),
    }


# ---------------------------------------------------------------------------
# Paiement par dossier (CinetPay) — chaque dossier se paie séparément
# ---------------------------------------------------------------------------
PLAN_PRIX_FCFA = {"diagnostic": 0, "rapport": 65000, "dossier": 130000, "vip": 500000}


class CheckoutRequest(BaseModel):
    email: str
    plan: str = "rapport"


@router.post("/{dossier_id}/checkout")
def checkout_dossier(
    dossier_id: str,
    payload: CheckoutRequest,
    x_user_id: str | None = Header(default=None, alias="X-User-Id"),
) -> dict:
    """Crée un paiement CinetPay pour ce dossier (tarif réduit -20% si fidélité)."""
    _get_dossier(dossier_id)
    supabase = get_supabase()

    base = PLAN_PRIX_FCFA.get(payload.plan, PLAN_PRIX_FCFA["rapport"])
    # Réduction fidélité : -20% si l'utilisateur a déjà un dossier payé.
    remise = False
    if x_user_id:
        autres = (
            supabase.table("dossiers_universels")
            .select("id")
            .eq("user_id", x_user_id)
            .eq("statut_paiement", "paye")
            .limit(1)
            .execute()
        )
        remise = bool(autres.data)
    montant = round(base * 0.8 / 5) * 5 if remise else base  # arrondi multiple de 5 (XOF)

    transaction_id = f"vc_dos_{uuid.uuid4().hex[:16]}"
    try:
        result = cinetpay.initiate_payment(
            transaction_id=transaction_id,
            amount=montant,
            description=f"VisaCoach — dossier ({payload.plan})",
            customer_email=payload.email,
            metadata=dossier_id,
        )
    except cinetpay.CinetPayError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    try:
        supabase.table("dossiers_universels").update(
            {
                "statut_paiement": "en_attente",
                "plan": payload.plan,
                "montant_paye": montant,
                "paiement_transaction_id": transaction_id,
                "updated_at": "now()",
            }
        ).eq("id", dossier_id).execute()
    except Exception:  # noqa: BLE001 — colonnes absentes : on ignore
        pass

    return {"payment_url": result["payment_url"], "montant": montant, "remise": remise}


@router.get("/{dossier_id}/verifier-paiement")
def verifier_paiement(dossier_id: str) -> dict:
    """Vérifie le statut du paiement CinetPay et bascule le dossier en 'paye'."""
    dossier = _get_dossier(dossier_id)
    if dossier.get("statut_paiement") == "paye":
        return {"paye": True}
    tid = dossier.get("paiement_transaction_id")
    if not tid:
        return {"paye": False}
    try:
        check = cinetpay.check_payment(tid)
    except cinetpay.CinetPayError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    if check["status"] == "ACCEPTED":
        get_supabase().table("dossiers_universels").update(
            {"statut_paiement": "paye", "updated_at": "now()"}
        ).eq("id", dossier_id).execute()
        return {"paye": True}
    return {"paye": False, "status": check["status"]}


@router.post("/extraire-donnees/{piece_id}")
def extraire_donnees(piece_id: str) -> dict:
    """Extrait et enregistre les données structurées d'une pièce."""
    supabase = get_supabase()
    r = (
        supabase.table("dossier_pieces")
        .select("*")
        .eq("id", piece_id)
        .limit(1)
        .execute()
    )
    if not r.data:
        raise HTTPException(status_code=404, detail="Document introuvable.")
    piece = r.data[0]
    donnees = analyse_coherence.extraire_donnees_document(
        piece["type_document"],
        piece.get("feedback_ia") or "",
        piece.get("storage_path") or "",
    )
    supabase.table("dossier_pieces").update({"donnees_extraites": donnees}).eq(
        "id", piece_id
    ).execute()
    return donnees


# ---------------------------------------------------------------------------
# Profil de risque
# ---------------------------------------------------------------------------
@router.get("/{dossier_id}/risque")
def risque(dossier_id: str, refresh: bool = False) -> dict:
    dossier = _get_dossier(dossier_id)
    if dossier.get("profil_risque") and not refresh:
        return dossier["profil_risque"]

    pieces = _pieces(dossier_id)
    profil = {
        **(dossier.get("profil_demandeur") or {}),
        "documents_fournis": len([p for p in pieces if p["statut"] != "a_fournir"]),
        "documents_valides": len([p for p in pieces if p["statut"] == "valide"]),
    }
    result = profil_risque.calculer_profil_risque(
        profil,
        dossier["type_visa"],
        dossier["pays_origine"],
        dossier["pays_destination"],
    )
    get_supabase().table("dossiers_universels").update(
        {"profil_risque": result, "updated_at": "now()"}
    ).eq("id", dossier_id).execute()
    return result


# ---------------------------------------------------------------------------
# Date optimale de dépôt (heuristique déterministe)
# ---------------------------------------------------------------------------
@router.get("/{dossier_id}/date-depot")
def date_depot(dossier_id: str) -> dict:
    _get_dossier(dossier_id)
    today = date.today()
    # Laisser ~3 semaines pour finaliser le dossier et prendre rendez-vous.
    cible = today + timedelta(days=21)
    peak = cible.month in (6, 7, 8)
    explication = (
        "Déposez environ 3 semaines après avoir réuni vos pièces, pour tenir compte "
        "des délais de rendez-vous et de traitement consulaire (souvent 10 à 20 jours)."
    )
    if peak:
        explication += (
            " ⚠️ La période juin–août est la plus chargée : prenez rendez-vous le plus "
            "tôt possible, les créneaux partent vite."
        )
    get_supabase().table("dossiers_universels").update(
        {"date_depot_optimale": cible.isoformat()}
    ).eq("id", dossier_id).execute()
    return {
        "date_optimale": cible.isoformat(),
        "jours_restants": (cible - today).days,
        "explication": explication,
    }


# ---------------------------------------------------------------------------
# Astuces pour une pièce
# ---------------------------------------------------------------------------
class AstuceRequest(BaseModel):
    type_document: str


@router.post("/{dossier_id}/astuce")
def astuce(dossier_id: str, payload: AstuceRequest) -> dict:
    dossier = _get_dossier(dossier_id)
    items = {
        i["id"]: i
        for i in checklist_officielle.get_checklist(
            dossier["type_visa"], dossier["pays_destination"]
        )
    }
    item = items.get(payload.type_document)
    label = item["label"] if item else payload.type_document

    user = f"""Donne des conseils pratiques pour obtenir et préparer le document \
« {label} » pour un visa {dossier['type_visa']} vers {dossier['pays_destination']}, \
depuis {dossier['pays_origine']}.

Explique : où/comment l'obtenir, le délai à prévoir, les pièges à éviter, et une \
astuce légale pour renforcer ce point. Réponds en français, 4 à 6 puces concises \
commençant par « - »."""
    try:
        msg = _client.messages.create(
            model=settings.CLAUDE_MODEL,
            max_tokens=800,
            system="Tu es un conseiller visa pragmatique pour l'Afrique francophone.",
            messages=[{"role": "user", "content": user}],
        )
        astuce_txt = "\n".join(b.text for b in msg.content if b.type == "text").strip()
    except anthropic.APIError as exc:
        raise HTTPException(status_code=502, detail=f"Erreur IA : {exc}") from exc

    return {
        "type_document": payload.type_document,
        "label": label,
        "astuce_officielle": item.get("astuce") if item else None,
        "conseils": astuce_txt,
    }
