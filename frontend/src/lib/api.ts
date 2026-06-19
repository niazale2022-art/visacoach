// Client API VisaCoach : enveloppe fetch typée vers le backend FastAPI.

import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

/** Renvoie l'en-tête X-User-Id si un utilisateur est connecté, sinon {}. */
async function userIdHeader(): Promise<Record<string, string>> {
  try {
    const { data } = await supabase.auth.getSession();
    const id = data.session?.user?.id;
    return id ? { "X-User-Id": id } : {};
  } catch {
    return {};
  }
}

// ---------------------------------------------------------------------------
// Types partagés
// ---------------------------------------------------------------------------
export interface QuestionOption {
  value: string;
  label: string;
}

export interface Question {
  id: string;
  label: string;
  options: QuestionOption[];
}

export interface Answer {
  question_id: string;
  value: string;
}

export type Level = "faible" | "moyen" | "bon" | "excellent";

export interface DiagnosticResult {
  id: string;
  score: number;
  level: Level;
  summary: string;
}

export type Plan = "rapport" | "suivi";
export type Provider = "cinetpay" | "stripe";

export interface CheckoutResult {
  order_id: string;
  provider: Provider;
  payment_url: string;
}

export interface Report {
  id: string;
  diagnostic_id: string;
  plan: Plan;
  content: string;
  email_sent: boolean;
}

// --- Dossier ---------------------------------------------------------
export type DocStatus = "EN_ATTENTE" | "VALIDE" | "ATTENTION" | "PROBLEME";

export interface DossierDocument {
  id: string;
  diagnostic_id: string;
  type: string;
  filename: string;
  status: DocStatus;
  note: number | null;
  feedback: string | null;
  suggestions: string[] | null;
}

export interface DossierProgress {
  diagnostic_id: string;
  score_global: number;
  documents_requis: string[];
  documents_valides: number;
  documents_total: number;
}

// --- Génération IA ---------------------------------------------------
export interface GeneratedText {
  content: string;
}

export interface Conseils {
  entretien: string[];
  dossier: string[];
  erreurs_a_eviter: string[];
  delais: string;
  points_faibles: string[];
}

// --- Visa Étudiant ---------------------------------------------------
export interface EtudiantDiagnosticPayload {
  pays_destination: string;
  niveau_etudes: string;
  domaine: string;
  niveau_francais: string;
  test_langue?: string;
  etablissement: string;
  campus_france_status: string;
  budget_mensuel: string;
  garant: boolean;
  situation_academique: string;
}

export interface EtudiantDiagnosticResult {
  id: string;
  score: number;
  level: Level;
  summary: string;
  pays_destination: string;
  niveau_etudes: string;
  domaine: string;
}

export interface Universite {
  nom: string;
  ville: string;
  programme: string;
  type: string;
  pourquoi: string;
}

export interface CampusFranceGuide {
  etapes: string[];
  questions: { question: string; reponse: string }[];
  erreurs: string[];
}

export interface SimulationEntretien {
  questions: { question: string; reponse_suggeree: string; evaluation: string }[];
  conseils: string[];
}

export interface ChecklistVisa {
  sections: { titre: string; items: string[] }[];
}

export interface Bourse {
  nom: string;
  organisme: string;
  montant: string;
  niveau: string[];
  deadline: string;
  lien: string;
  eligible_pays: string[];
  difficulte: string;
}

// --- Dossier universel ----------------------------------------------
export interface ProfilDemandeur {
  age?: number;
  situation_familiale?: string;
  proprietaire?: boolean;
  historique_voyage?: string;
  statut_emploi?: string;
}

export type PieceStatut =
  | "a_fournir"
  | "uploade"
  | "valide"
  | "incomplet"
  | "probleme";

export interface ChecklistItem {
  id: string;
  label: string;
  obligatoire: boolean;
  format?: string;
  astuce?: string;
  risque_si_absent?: string;
  validite?: string;
  delai_obtention?: string;
  lien_officiel?: string;
  statut: PieceStatut;
  note: number | null;
  feedback_ia: string | null;
  suggestions: string[];
}

export interface DossierPiece {
  id: string;
  type_document: string;
  label: string;
  obligatoire: boolean;
  statut: PieceStatut;
  note: number | null;
  feedback_ia: string | null;
  suggestions: string[];
}

export interface DossierUniversel {
  id: string;
  type_visa: string;
  pays_destination: string;
  pays_origine: string;
  statut: string;
  score_global: number;
  score_coherence: number | null;
  documents_total: number;
  documents_valides: number;
  pieces: DossierPiece[];
}

export interface DossierSummary {
  id: string;
  type_visa: string;
  pays_destination: string;
  pays_origine: string;
  statut: string;
  score_global: number;
}

export interface Incoherence {
  titre: string;
  description: string;
  documents_impliques: string[];
  impact: string;
  solution: string;
}

export interface Vigilance {
  titre: string;
  description: string;
  conseil: string;
}

export interface Recommandation {
  priorite: number;
  action: string;
  raison: string;
  urgence: string;
}

export interface CoherenceAnalyse {
  pret: boolean;
  message?: string;
  nb_documents_analyses?: number;
  score_coherence: number | null;
  niveau?: string;
  resume_consul?: string;
  incoherences_critiques?: Incoherence[];
  points_vigilance?: Vigilance[];
  points_forts?: string[];
  recommandations_prioritaires?: Recommandation[];
  verdict_consul?: string;
  probabilite_accord?: number;
}

export interface RisqueResult {
  score_risque: number;
  niveau: string;
  facteurs_aggravants: { facteur: string; impact: string; strategie: string }[];
  facteurs_rassurants: string[];
  message_cle: string;
}

export interface DateDepotResult {
  date_optimale: string;
  jours_restants: number;
  explication: string;
}

export interface AstuceResult {
  type_document: string;
  label: string;
  astuce_officielle: string | null;
  conseils: string;
}

// ---------------------------------------------------------------------------
// Helper générique
// ---------------------------------------------------------------------------
async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const authHeader = await userIdHeader();
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options?.headers as Record<string, string> | undefined),
    },
  });

  if (!response.ok) {
    let message = `Erreur ${response.status}`;
    try {
      const data = await response.json();
      if (data?.detail) message = data.detail;
    } catch {
      // réponse non-JSON : on garde le message par défaut
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

// ---------------------------------------------------------------------------
// Endpoints
// ---------------------------------------------------------------------------
export const api = {
  // Diagnostics
  getQuestions: () =>
    request<{ questions: Question[] }>("/api/diagnostics/questions"),

  submitDiagnostic: (payload: {
    email: string;
    full_name?: string;
    country?: string;
    answers: Answer[];
  }) =>
    request<DiagnosticResult>("/api/diagnostics", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getDiagnostic: (id: string) =>
    request<DiagnosticResult>(`/api/diagnostics/${id}`),

  // Diagnostics de l'utilisateur connecté (lus côté backend via service_role,
  // l'en-tête X-User-Id est ajouté automatiquement par request()).
  listUserDiagnostics: () =>
    request<
      {
        id: string;
        score: number;
        level: Level;
        answers: Answer[];
        created_at: string;
      }[]
    >("/api/diagnostics/mine"),

  // Paiements
  checkout: (
    provider: Provider,
    payload: {
      diagnostic_id: string;
      email: string;
      plan: Plan;
      full_name?: string;
    },
  ) =>
    request<CheckoutResult>(`/api/payments/${provider}/checkout`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  // Rapports
  generateReport: (diagnostic_id: string) =>
    request<Report>("/api/reports/generate", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  getReport: (diagnostic_id: string) =>
    request<Report>(`/api/reports/${diagnostic_id}`),

  // Dossier
  getProgress: (diagnostic_id: string) =>
    request<DossierProgress>(`/api/dossier/${diagnostic_id}/progress`),

  listDocuments: (diagnostic_id: string) =>
    request<DossierDocument[]>(`/api/dossier/${diagnostic_id}/documents`),

  uploadDocument: async (
    diagnostic_id: string,
    type: string,
    file: File,
  ): Promise<DossierDocument> => {
    const form = new FormData();
    form.append("type", type);
    form.append("file", file);
    // Pas de Content-Type manuel : le navigateur ajoute la boundary multipart.
    const response = await fetch(
      `${API_URL}/api/dossier/${diagnostic_id}/documents`,
      { method: "POST", body: form, headers: await userIdHeader() },
    );
    if (!response.ok) {
      let message = `Erreur ${response.status}`;
      try {
        const data = await response.json();
        if (data?.detail) message = data.detail;
      } catch {
        /* réponse non-JSON */
      }
      throw new Error(message);
    }
    return (await response.json()) as DossierDocument;
  },

  verifyDocument: (diagnostic_id: string, doc_id: string) =>
    request<DossierDocument>(
      `/api/dossier/${diagnostic_id}/verify/${doc_id}`,
      { method: "POST" },
    ),

  deleteDocument: (diagnostic_id: string, doc_id: string) =>
    request<{ deleted: boolean }>(
      `/api/dossier/${diagnostic_id}/documents/${doc_id}`,
      { method: "DELETE" },
    ),

  // Génération IA
  generateLettreMotivation: (diagnostic_id: string) =>
    request<GeneratedText>(
      `/api/generation/${diagnostic_id}/lettre-motivation`,
      { method: "POST" },
    ),

  generateLettreInvitation: (diagnostic_id: string) =>
    request<GeneratedText>(
      `/api/generation/${diagnostic_id}/lettre-invitation`,
      { method: "POST" },
    ),

  generatePlanSejour: (diagnostic_id: string) =>
    request<GeneratedText>(`/api/generation/${diagnostic_id}/plan-sejour`, {
      method: "POST",
    }),

  generateConseils: (diagnostic_id: string) =>
    request<Conseils>(`/api/generation/${diagnostic_id}/conseils`, {
      method: "POST",
    }),

  // Visa Étudiant
  createEtudiantDiagnostic: (payload: EtudiantDiagnosticPayload) =>
    request<EtudiantDiagnosticResult>("/api/etudiant/diagnostic", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  getEtudiantDiagnostic: (id: string) =>
    request<EtudiantDiagnosticResult>(`/api/etudiant/diagnostic/${id}`),

  etudiantUniversites: (diagnostic_id: string) =>
    request<{ universites: Universite[] }>("/api/etudiant/universites", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  etudiantLettreMotivation: (diagnostic_id: string) =>
    request<GeneratedText>("/api/etudiant/lettre-motivation", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  etudiantCampusFrance: (diagnostic_id: string) =>
    request<CampusFranceGuide>("/api/etudiant/campus-france", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  etudiantSimulation: (diagnostic_id: string) =>
    request<SimulationEntretien>("/api/etudiant/simulation-entretien", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  etudiantChecklistVisa: (diagnostic_id: string) =>
    request<ChecklistVisa>("/api/etudiant/checklist-visa", {
      method: "POST",
      body: JSON.stringify({ diagnostic_id }),
    }),

  etudiantBourses: (pays: string, niveau?: string) =>
    request<{ bourses: Bourse[] }>(
      `/api/etudiant/bourses/${pays}${niveau ? `?niveau=${niveau}` : ""}`,
    ),

  // Dossier universel
  creerDossier: (payload: {
    type_visa: string;
    pays_destination: string;
    pays_origine: string;
    profil?: ProfilDemandeur;
  }) =>
    request<{ dossier_id: string }>("/api/dossier-universel/creer", {
      method: "POST",
      body: JSON.stringify(payload),
    }),

  mesDossiers: () =>
    request<{ dossiers: DossierSummary[] }>("/api/dossier-universel/mine"),

  getDossier: (id: string) =>
    request<DossierUniversel>(`/api/dossier-universel/${id}`),

  getChecklist: (id: string) =>
    request<{ checklist: ChecklistItem[] }>(
      `/api/dossier-universel/${id}/checklist`,
    ),

  uploadPiece: async (
    id: string,
    type_document: string,
    file: File,
  ): Promise<{ piece: DossierPiece; score_global: number }> => {
    const form = new FormData();
    form.append("type_document", type_document);
    form.append("file", file);
    const response = await fetch(
      `${API_URL}/api/dossier-universel/${id}/upload`,
      { method: "POST", body: form },
    );
    if (!response.ok) {
      let message = `Erreur ${response.status}`;
      try {
        const data = await response.json();
        if (data?.detail) message = data.detail;
      } catch {
        /* non-JSON */
      }
      throw new Error(message);
    }
    return (await response.json()) as { piece: DossierPiece; score_global: number };
  },

  analyseCoherence: (id: string) =>
    request<CoherenceAnalyse>("/api/dossier-universel/coherence", {
      method: "POST",
      body: JSON.stringify({ dossier_id: id }),
    }),

  getAnalyseCoherence: (id: string) =>
    request<CoherenceAnalyse>(`/api/dossier-universel/coherence/${id}`),

  getProfilRisque: (id: string) =>
    request<RisqueResult>(`/api/dossier-universel/${id}/risque`),

  getDateDepot: (id: string) =>
    request<DateDepotResult>(`/api/dossier-universel/${id}/date-depot`),

  getAstuce: (id: string, type_document: string) =>
    request<AstuceResult>(`/api/dossier-universel/${id}/astuce`, {
      method: "POST",
      body: JSON.stringify({ type_document }),
    }),
};

export { API_URL };
