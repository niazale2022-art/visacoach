"""Analyse de cohérence inter-documents — le différenciateur de VisaCoach.

Au-delà de l'analyse individuelle de chaque pièce, ce service :
  1. extrait les données structurées de chaque document (dates, montants, identité…) ;
  2. simule l'examen consulaire en cherchant les INCOHÉRENCES entre documents
     (contradictions financières, dates qui ne collent pas, motif suspect…),
     et rend un verdict + une probabilité d'accord estimée.
"""

from __future__ import annotations

import json

import anthropic

from app.core.config import settings

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)


def _json_call(system: str | None, user: str, max_tokens: int):
    """Appel Claude pour une sortie JSON (pas de thinking : budget pour le JSON)."""
    kwargs: dict = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "messages": [{"role": "user", "content": user}],
    }
    if system:
        kwargs["system"] = system
    msg = _client.messages.create(**kwargs)
    raw = "\n".join(b.text for b in msg.content if b.type == "text").strip()
    if raw.startswith("```"):
        raw = raw.strip("`")
        if raw.lower().startswith("json"):
            raw = raw[4:]
        raw = raw.strip()
    return json.loads(raw)


# ---------------------------------------------------------------------------
# 1. Extraction des données structurées d'un document
# ---------------------------------------------------------------------------
def extraire_donnees_document(
    document_type: str, feedback_ia: str, storage_path: str = ""
) -> dict:
    """Extrait les données factuelles clés d'un document déjà analysé."""
    user = f"""À partir de cette analyse de document visa, extrais les données structurées clés.

Type de document : {document_type}
Analyse existante : {feedback_ia}

Extrais UNIQUEMENT les données factuelles présentes. Si une donnée n'est pas \
mentionnée, mets null. Réponds UNIQUEMENT en JSON sans markdown :
{{
  "type": "{document_type}",
  "dates": {{"emission": null, "expiration": null, "debut_validite": null, "fin_validite": null}},
  "montants": {{"solde": null, "revenu_mensuel": null, "montant_couverture": null}},
  "identite": {{"nom": null, "prenom": null, "adresse": null, "nationalite": null}},
  "sejour": {{"date_arrivee": null, "date_depart": null, "duree_jours": null, "destination": null, "hebergement_type": null}},
  "professionnel": {{"employeur": null, "poste": null, "salaire_mensuel": null, "type_contrat": null}},
  "flags": []
}}"""
    try:
        return _json_call(None, user, max_tokens=800)
    except (anthropic.APIError, json.JSONDecodeError, ValueError):
        return {"type": document_type, "erreur": "extraction impossible"}


# ---------------------------------------------------------------------------
# 2. Analyse de cohérence globale (verdict consulaire)
# ---------------------------------------------------------------------------
_SYSTEM = (
    "Tu es un consul expérimenté qui examine un dossier de visa. Tu cherches les "
    "incohérences entre documents comme lors d'un vrai examen consulaire. Tu "
    "réponds UNIQUEMENT avec un objet JSON valide, sans texte autour ni markdown."
)


def _obj_list(value: object, keys: list[str]) -> list[dict]:
    out: list[dict] = []
    if not isinstance(value, list):
        return out
    for v in value:
        if isinstance(v, dict):
            out.append({k: v.get(k) for k in keys})
        else:
            out.append({keys[0]: str(v)})
    return out


def analyser_coherence_globale(
    documents: list[dict],
    type_visa: str,
    pays_destination: str,
    pays_origine: str,
    profil: dict | None = None,
) -> dict:
    """Analyse la cohérence entre TOUS les documents et rend un verdict consulaire."""
    docs_context = []
    for doc in documents:
        if doc.get("statut") in ("valide", "incomplet", "probleme", "attention") and doc.get(
            "donnees_extraites"
        ):
            docs_context.append(
                {
                    "type": doc["type_document"],
                    "label": doc["label"],
                    "statut": doc["statut"],
                    "donnees": doc["donnees_extraites"],
                    "feedback": (doc.get("feedback_ia") or "")[:200],
                }
            )

    if len(docs_context) < 2:
        return {
            "pret": False,
            "score_coherence": None,
            "message": "Uploadez au moins 2 documents pour lancer l'analyse de cohérence.",
        }

    user = f"""Tu examines un dossier de visa {type_visa} pour {pays_destination} \
d'un ressortissant de {pays_origine}. Tu as reçu {len(docs_context)} documents.

Documents et données extraites :
{json.dumps(docs_context, ensure_ascii=False, indent=2)}

Profil déclaré du demandeur :
{json.dumps(profil or {}, ensure_ascii=False, indent=2)}

RÈGLES D'ANALYSE CONSULAIRE :
1. CONTRADICTIONS entre documents (dates, montants, adresses, identité)
2. COHÉRENCE TEMPORELLE (validités, durées, chevauchements)
3. COHÉRENCE FINANCIÈRE (revenus vs solde vs coût du séjour)
4. SIGNAUX DE FRAUDE (dépôts brutaux, incohérences d'identité)
5. COHÉRENCE DU MOTIF (ce qui est dit vs ce qui est montré)
6. LIENS AVEC LE PAYS D'ORIGINE (raisons de revenir)

Réponds UNIQUEMENT en JSON sans markdown :
{{
  "score_coherence": 0,
  "niveau": "EXCELLENT|BON|MOYEN|FAIBLE|CRITIQUE",
  "resume_consul": "Ce que penserait le consul (2-3 phrases directes)",
  "incoherences_critiques": [
    {{"titre": "...", "description": "...", "documents_impliques": ["..."], "impact": "BLOQUANT|MAJEUR|MINEUR", "solution": "..."}}
  ],
  "points_vigilance": [{{"titre": "...", "description": "...", "conseil": "..."}}],
  "points_forts": ["..."],
  "recommandations_prioritaires": [
    {{"priorite": 1, "action": "...", "raison": "...", "urgence": "IMMEDIATE|AVANT_DEPOT|OPTIONNEL"}}
  ],
  "verdict_consul": "FAVORABLE|RESERVE|DEFAVORABLE",
  "probabilite_accord": 0
}}"""

    try:
        data = _json_call(_SYSTEM, user, max_tokens=3500)
    except (anthropic.APIError, json.JSONDecodeError, ValueError) as exc:
        raise RuntimeError(f"Analyse de cohérence impossible : {exc}") from exc

    def _int(v: object, default: int = 0) -> int:
        try:
            return max(0, min(100, int(v)))  # type: ignore[arg-type]
        except (TypeError, ValueError):
            return default

    niveau = str(data.get("niveau", "MOYEN")).upper()
    if niveau not in ("EXCELLENT", "BON", "MOYEN", "FAIBLE", "CRITIQUE"):
        niveau = "MOYEN"
    verdict = str(data.get("verdict_consul", "RESERVE")).upper()
    if verdict not in ("FAVORABLE", "RESERVE", "DEFAVORABLE"):
        verdict = "RESERVE"

    return {
        "pret": True,
        "nb_documents_analyses": len(docs_context),
        "score_coherence": _int(data.get("score_coherence")),
        "niveau": niveau,
        "resume_consul": str(data.get("resume_consul", "")),
        "incoherences_critiques": _obj_list(
            data.get("incoherences_critiques"),
            ["titre", "description", "documents_impliques", "impact", "solution"],
        ),
        "points_vigilance": _obj_list(
            data.get("points_vigilance"), ["titre", "description", "conseil"]
        ),
        "points_forts": [str(x) for x in (data.get("points_forts") or [])],
        "recommandations_prioritaires": _obj_list(
            data.get("recommandations_prioritaires"),
            ["priorite", "action", "raison", "urgence"],
        ),
        "verdict_consul": verdict,
        "probabilite_accord": _int(data.get("probabilite_accord")),
    }
