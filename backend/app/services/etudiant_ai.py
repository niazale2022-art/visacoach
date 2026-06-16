"""IA dédiée au parcours « Visa Étudiant » (Claude).

Génère lettres de motivation académiques, guide Campus France, simulation
d'entretien, recommandations d'universités et checklist visa. Fournit aussi un
catalogue de bourses (données statiques, sans IA).
"""

from __future__ import annotations

import json

import anthropic

from app.core.config import settings

_client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)

# Libellés lisibles (valeurs du diagnostic -> texte).
PAYS_LABELS = {
    "france": "France",
    "canada": "Canada",
    "usa": "États-Unis",
    "belgique": "Belgique",
    "suisse": "Suisse",
}
NIVEAU_LABELS = {
    "licence": "Licence",
    "master": "Master",
    "doctorat": "Doctorat",
    "bts_dut": "BTS / DUT",
}
DOMAINE_LABELS = {
    "informatique": "Informatique",
    "medecine": "Médecine",
    "droit": "Droit",
    "commerce": "Commerce",
    "ingenierie": "Ingénierie",
    "autre": "Autre",
}
FRANCAIS_LABELS = {
    "courant": "courant",
    "intermediaire": "intermédiaire",
    "debutant": "débutant",
}
SITUATION_LABELS = {
    "bac": "Bac",
    "bac2": "Bac+2",
    "bac3": "Bac+3",
    "bac5": "Bac+5 ou plus",
}


def profile_block(d: dict) -> str:
    """Met en forme le profil de l'étudiant pour les prompts."""
    return (
        f"- Pays de destination : {PAYS_LABELS.get(d.get('pays_destination', ''), d.get('pays_destination'))}\n"
        f"- Niveau d'études visé : {NIVEAU_LABELS.get(d.get('niveau_etudes', ''), d.get('niveau_etudes'))}\n"
        f"- Domaine : {DOMAINE_LABELS.get(d.get('domaine', ''), d.get('domaine'))}\n"
        f"- Niveau de français : {FRANCAIS_LABELS.get(d.get('niveau_francais', ''), d.get('niveau_francais'))}\n"
        f"- Test de langue : {d.get('test_langue') or 'non précisé'}\n"
        f"- Établissement d'accueil confirmé : {'oui' if d.get('etablissement_confirme') else 'non / en recherche'}\n"
        f"- Campus France : {d.get('campus_france_status') or 'non précisé'}\n"
        f"- Budget mensuel : {d.get('budget_mensuel') or 'non précisé'}\n"
        f"- Garant : {'oui' if d.get('garant') else 'non'}\n"
        f"- Situation académique actuelle : {SITUATION_LABELS.get(d.get('situation_academique', ''), d.get('situation_academique'))}"
    )


def _text(
    system: str, user: str, max_tokens: int = 2500, use_thinking: bool = True
) -> str:
    # IMPORTANT : `max_tokens` couvre la réflexion (thinking) ET la sortie. Pour
    # une sortie JSON, on désactive la réflexion afin que tout le budget aille au
    # JSON (sinon le JSON est tronqué -> parse error).
    kwargs: dict = {
        "model": settings.CLAUDE_MODEL,
        "max_tokens": max_tokens,
        "system": system,
        "messages": [{"role": "user", "content": user}],
    }
    if use_thinking:
        kwargs["thinking"] = {"type": "adaptive"}
    try:
        message = _client.messages.create(**kwargs)
    except anthropic.APIError as exc:
        raise RuntimeError(f"Erreur IA : {exc}") from exc
    return "\n".join(b.text for b in message.content if b.type == "text").strip()


def _json(system: str, user: str, max_tokens: int = 4000):
    # Pas de thinking + budget généreux : garantit un JSON complet.
    raw = _text(system, user, max_tokens, use_thinking=False)
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:]
        cleaned = cleaned.strip()
    return json.loads(cleaned)


# ---------------------------------------------------------------------------
# Fonction 1 — Lettre de motivation académique
# ---------------------------------------------------------------------------
def generate_lettre_motivation_academique(d: dict) -> str:
    system = (
        "Tu es expert en candidatures universitaires internationales. Tu rédiges "
        "des lettres de motivation académiques en français impeccable, formelles "
        "et convaincantes."
    )
    user = f"""Rédige une lettre de motivation académique (400 à 500 mots, format A4) \
pour ce candidat étudiant.

Profil :
{profile_block(d)}

La lettre doit contenir : lieu/date, objet, formule d'appel, parcours académique, \
projet professionnel cohérent avec le domaine, motivation pour le pays et \
l'établissement, valeur ajoutée pour l'établissement d'accueil, intention claire \
de retour au pays d'origine, formule de politesse et signature ([Nom]).
Réponds uniquement avec le texte de la lettre."""
    return _text(system, user, max_tokens=2500)


# ---------------------------------------------------------------------------
# Fonction 2 — Guide Campus France personnalisé
# ---------------------------------------------------------------------------
def generate_campus_france_guide(d: dict) -> dict:
    system = (
        "Tu es conseiller Campus France pour étudiants d'Afrique subsaharienne "
        "francophone. Tu réponds UNIQUEMENT avec un JSON valide, sans texte autour."
    )
    user = f"""Crée un guide Campus France personnalisé.

Profil :
{profile_block(d)}

Réponds avec ce JSON exact :
{{
  "etapes": ["étape 1 datée/concrète", "..."],
  "questions": [{{"question": "...", "reponse": "réponse suggérée"}}],
  "erreurs": ["erreur fréquente à éviter", "..."]
}}
3 à 7 éléments par liste, adaptés au pays et au profil. Si Campus France ne \
s'applique pas (Canada/USA), explique la procédure équivalente dans `etapes`."""
    data = _json(system, user)
    return {
        "etapes": [str(x) for x in data.get("etapes", [])],
        "questions": [
            {"question": str(q.get("question", "")), "reponse": str(q.get("reponse", ""))}
            for q in data.get("questions", [])
            if isinstance(q, dict)
        ],
        "erreurs": [str(x) for x in data.get("erreurs", [])],
    }


# ---------------------------------------------------------------------------
# Fonction 3 — Simulation d'entretien Campus France
# ---------------------------------------------------------------------------
def generate_simulation_entretien(d: dict) -> dict:
    system = (
        "Tu es examinateur Campus France expérimenté. Tu prépares des simulations "
        "d'entretien réalistes. Tu réponds UNIQUEMENT avec un JSON valide."
    )
    user = f"""Génère une simulation d'entretien Campus France.

Profil :
{profile_block(d)}

Réponds avec ce JSON exact :
{{
  "questions": [
    {{"question": "...", "reponse_suggeree": "...", "evaluation": "ce que l'examinateur évalue"}}
  ],
  "conseils": ["conseil de présentation", "..."]
}}
8 à 10 questions probables selon le profil, et 3 à 5 conseils."""
    data = _json(system, user, max_tokens=4000)
    return {
        "questions": [
            {
                "question": str(q.get("question", "")),
                "reponse_suggeree": str(q.get("reponse_suggeree", "")),
                "evaluation": str(q.get("evaluation", "")),
            }
            for q in data.get("questions", [])
            if isinstance(q, dict)
        ],
        "conseils": [str(x) for x in data.get("conseils", [])],
    }


# ---------------------------------------------------------------------------
# Recommandations d'universités
# ---------------------------------------------------------------------------
def generate_universites(d: dict) -> list[dict]:
    system = (
        "Tu es conseiller en orientation internationale. Tu recommandes des "
        "universités réelles et crédibles. Tu réponds UNIQUEMENT avec un JSON."
    )
    user = f"""Recommande 5 à 8 établissements adaptés à ce profil étudiant.

Profil :
{profile_block(d)}

Réponds avec ce JSON exact :
{{"universites": [
  {{"nom": "...", "ville": "...", "programme": "...", "type": "public|privé",
    "pourquoi": "pourquoi ce choix correspond au profil"}}
]}}
Établissements réels du pays de destination, cohérents avec le niveau et le domaine."""
    data = _json(system, user)
    items = data.get("universites", []) if isinstance(data, dict) else []
    return [
        {
            "nom": str(u.get("nom", "")),
            "ville": str(u.get("ville", "")),
            "programme": str(u.get("programme", "")),
            "type": str(u.get("type", "")),
            "pourquoi": str(u.get("pourquoi", "")),
        }
        for u in items
        if isinstance(u, dict)
    ]


# ---------------------------------------------------------------------------
# Checklist visa étudiant personnalisée
# ---------------------------------------------------------------------------
def generate_checklist_visa(d: dict) -> dict:
    system = (
        "Tu es expert en visas étudiants. Tu réponds UNIQUEMENT avec un JSON valide."
    )
    user = f"""Crée une checklist personnalisée des documents et démarches pour le \
visa étudiant de ce profil.

Profil :
{profile_block(d)}

Réponds avec ce JSON exact :
{{"sections": [
  {{"titre": "Documents administratifs", "items": ["...", "..."]}},
  {{"titre": "Documents financiers", "items": ["..."]}}
]}}
Adapte au pays de destination et au profil."""
    data = _json(system, user)
    sections = data.get("sections", []) if isinstance(data, dict) else []
    return {
        "sections": [
            {
                "titre": str(s.get("titre", "")),
                "items": [str(i) for i in s.get("items", [])],
            }
            for s in sections
            if isinstance(s, dict)
        ]
    }


# ---------------------------------------------------------------------------
# Fonction 4 — Bourses (données statiques)
# ---------------------------------------------------------------------------
_AFRIQUE_FR = [
    "Sénégal", "Côte d'Ivoire", "Cameroun", "Mali", "Congo",
    "Burkina Faso", "Bénin", "Togo", "Gabon", "Guinée",
]

_BOURSES: list[dict] = [
    {
        "nom": "Bourse Eiffel",
        "organisme": "Campus France / MEAE",
        "montant": "1 181 €/mois",
        "niveau": ["Master", "Doctorat"],
        "deadline": "Janvier de chaque année",
        "lien": "https://www.campusfrance.org/fr/eiffel",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Très sélective",
        "pays": "france",
    },
    {
        "nom": "Bourse du Gouvernement Français (BGF)",
        "organisme": "Ambassade de France",
        "montant": "Variable (≈ 700–1 060 €/mois)",
        "niveau": ["Licence", "Master", "Doctorat"],
        "deadline": "Variable selon le pays (souvent fév.–mars)",
        "lien": "https://www.campusfrance.org",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Sélective",
        "pays": "france",
    },
    {
        "nom": "Bourse AUF",
        "organisme": "Agence Universitaire de la Francophonie",
        "montant": "≈ 1 000 €/mois (Master/Doctorat)",
        "niveau": ["Master", "Doctorat"],
        "deadline": "Avril–Mai",
        "lien": "https://www.auf.org",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Sélective",
        "pays": "france",
    },
    {
        "nom": "Bourse AFD",
        "organisme": "Agence Française de Développement",
        "montant": "Variable selon programme",
        "niveau": ["Master"],
        "deadline": "Variable",
        "lien": "https://www.afd.fr",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Sélective",
        "pays": "france",
    },
    {
        "nom": "Bourse Île-de-France (régionale)",
        "organisme": "Région Île-de-France",
        "montant": "≈ 10 000 €/an",
        "niveau": ["Master"],
        "deadline": "Mai–Juin",
        "lien": "https://www.iledefrance.fr",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Modérément sélective",
        "pays": "france",
    },
    {
        "nom": "Bourses du gouvernement canadien / CRDI",
        "organisme": "Gouvernement du Canada / CRDI",
        "montant": "Variable (frais + subsistance)",
        "niveau": ["Master", "Doctorat"],
        "deadline": "Variable (souvent automne)",
        "lien": "https://www.educanada.ca",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Très sélective",
        "pays": "canada",
    },
    {
        "nom": "Bourse Fulbright",
        "organisme": "Gouvernement des États-Unis",
        "montant": "Frais de scolarité + subsistance",
        "niveau": ["Master", "Doctorat"],
        "deadline": "Variable selon le pays (printemps)",
        "lien": "https://foreign.fulbrightonline.org",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Très sélective",
        "pays": "usa",
    },
    {
        "nom": "Bourses de l'Union Africaine",
        "organisme": "Union Africaine",
        "montant": "Variable",
        "niveau": ["Licence", "Master", "Doctorat"],
        "deadline": "Variable",
        "lien": "https://au.int",
        "eligible_pays": _AFRIQUE_FR,
        "difficulte": "Sélective",
        "pays": "tous",
    },
]


def get_bourses(pays: str, niveau: str | None = None, domaine: str | None = None) -> list[dict]:
    """Retourne les bourses pertinentes pour un pays (et niveau optionnel)."""
    pays = (pays or "").lower()
    niveau_label = NIVEAU_LABELS.get((niveau or "").lower()) if niveau else None

    result = []
    for b in _BOURSES:
        if b["pays"] not in (pays, "tous"):
            continue
        if niveau_label and niveau_label not in b["niveau"]:
            continue
        result.append({k: v for k, v in b.items() if k != "pays"})
    return result
