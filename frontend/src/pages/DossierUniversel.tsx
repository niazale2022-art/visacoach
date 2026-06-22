import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import ChecklistOfficielle from "../components/dossier/ChecklistOfficielle";
import ZoneTravail from "../components/dossier/ZoneTravail";
import AnalyseCoherence from "../components/dossier/AnalyseCoherence";
import ProfilRisque from "../components/dossier/ProfilRisque";
import DateDepot from "../components/dossier/DateDepot";
import MartinChat from "../components/MartinChat";
import {
  api,
  type ChecklistItem,
  type DateDepotResult,
  type DossierPiece,
  type DossierUniversel as Dossier,
  type RisqueResult,
} from "../lib/api";
import { paysLabel, visaLabel } from "../lib/dossier";

export default function DossierUniversel() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  const [paying, setPaying] = useState(false);
  const [dossier, setDossier] = useState<Dossier | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [risque, setRisque] = useState<RisqueResult | null>(null);
  const [risqueLoading, setRisqueLoading] = useState(false);
  const [dateDepot, setDateDepot] = useState<DateDepotResult | null>(null);
  const [dateLoading, setDateLoading] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const [d, c] = await Promise.all([api.getDossier(id), api.getChecklist(id)]);
    setDossier(d);
    setScore(d.score_global);
    setChecklist(c.checklist);
    setSelectedId((cur) => cur ?? c.checklist[0]?.id ?? null);
  }, [id]);

  useEffect(() => {
    load()
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [load]);

  function onUploaded(piece: DossierPiece, scoreGlobal: number) {
    setChecklist((prev) =>
      prev.map((it) =>
        it.id === piece.type_document
          ? {
              ...it,
              statut: piece.statut,
              note: piece.note,
              feedback_ia: piece.feedback_ia,
              suggestions: piece.suggestions,
            }
          : it,
      ),
    );
    setScore(scoreGlobal);
  }

  async function runRisque() {
    if (!id) return;
    setRisqueLoading(true);
    try {
      setRisque(await api.getProfilRisque(id));
    } catch {
      /* ignoré */
    } finally {
      setRisqueLoading(false);
    }
  }

  async function runDate() {
    if (!id) return;
    setDateLoading(true);
    try {
      setDateDepot(await api.getDateDepot(id));
    } catch {
      /* ignoré */
    } finally {
      setDateLoading(false);
    }
  }

  async function handlePaiement(plan: string) {
    if (!id) return;
    setPaying(true);
    setError(null);
    try {
      const email = user?.email ?? "";
      const { payment_url } = await api.checkoutDossier(id, email, plan);
      localStorage.setItem("visacoach_dossier_paiement", id);
      window.location.href = payment_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paiement indisponible.");
      setPaying(false);
    }
  }

  // Paiement par carte bancaire (Stripe, en euros) — diaspora.
  async function handleStripePayment(plan: string) {
    if (!id) return;
    setPaying(true);
    setError(null);
    try {
      const apiUrl = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
      const res = await fetch(`${apiUrl}/api/stripe/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          dossier_id: id,
          user_email: user?.email ?? "",
          user_id: user?.id ?? "",
        }),
      });
      if (!res.ok) throw new Error("Paiement par carte indisponible.");
      const data = await res.json();
      if (!data.checkout_url) throw new Error("Lien de paiement manquant.");
      window.location.href = data.checkout_url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Paiement indisponible.");
      setPaying(false);
    }
  }

  if (loading) return <p className="py-20 text-center text-slate-500">Chargement…</p>;
  if (error && !dossier) return <p className="py-20 text-center text-red-600">{error}</p>;
  if (!dossier || !id) return null;

  const v = visaLabel(dossier.type_visa);
  const dest = paysLabel(dossier.pays_destination);
  const orig = paysLabel(dossier.pays_origine);
  const total = checklist.filter((i) => i.obligatoire).length;
  const valides = checklist.filter((i) => i.obligatoire && i.statut === "valide").length;
  const uploadedCount = checklist.filter((i) => i.statut !== "a_fournir").length;
  const selected = checklist.find((i) => i.id === selectedId) ?? null;

  return (
    <div className="space-y-6">
      {/* Bannière de paiement (si non payé) */}
      {dossier.statut_paiement !== "paye" && (
        <div
          style={{
            background: "linear-gradient(135deg, #1434A4, #0A2875)",
            borderRadius: "14px",
            padding: "24px",
            color: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "16px",
          }}
        >
          <div>
            <div style={{ fontWeight: 700, fontSize: "1rem", marginBottom: "4px" }}>
              🔓 Débloquez l'accompagnement complet
            </div>
            <div style={{ fontSize: "0.85rem", opacity: 0.8 }}>
              Rapport IA · Vérification documents · Analyse de cohérence · Conseils
              entretien
            </div>
            {dossier.statut_paiement === "en_attente" && (
              <button
                type="button"
                onClick={() => {
                  if (id) {
                    api.verifierPaiement(id).then((r) => {
                      if (r.paye) load();
                    });
                  }
                }}
                style={{
                  marginTop: 8,
                  background: "transparent",
                  color: "rgba(255,255,255,0.85)",
                  border: "1px solid rgba(255,255,255,0.4)",
                  padding: "6px 12px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: "0.78rem",
                }}
              >
                J'ai déjà payé — vérifier
              </button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#F7B731" }}>
                65 000 FCFA
              </div>
              <div style={{ fontSize: "0.72rem", opacity: 0.6 }}>≈ 99 €</div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <button
                type="button"
                onClick={() => handleStripePayment("rapport")}
                disabled={paying}
                style={{
                  background: "#F7B731",
                  color: "#0A0F2C",
                  border: "none",
                  padding: "12px 24px",
                  borderRadius: "8px",
                  fontWeight: 800,
                  cursor: paying ? "not-allowed" : "pointer",
                  fontSize: "0.9rem",
                  opacity: paying ? 0.7 : 1,
                }}
              >
                {paying ? "Redirection…" : "💳 Payer par carte (99 €)"}
              </button>
              <button
                type="button"
                onClick={() => handlePaiement("rapport")}
                disabled={paying}
                style={{
                  background: "transparent",
                  color: "white",
                  border: "1px solid rgba(255,255,255,0.45)",
                  padding: "10px 24px",
                  borderRadius: "8px",
                  fontWeight: 700,
                  cursor: paying ? "not-allowed" : "pointer",
                  fontSize: "0.85rem",
                  opacity: paying ? 0.7 : 1,
                }}
              >
                📱 Mobile Money (65 000 FCFA)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zone 1 — En-tête */}
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-900">
          {v.icon} Visa {v.label} · {dest.flag} {dest.label}
        </h1>
        <p className="text-sm text-slate-500">
          Depuis : {orig.flag} {orig.label}
          {dossier.beneficiaire_type === "proche" && (
            <> · Bénéficiaire : {dossier.beneficiaire_prenom || "Proche"}</>
          )}
        </p>

        {dossier.beneficiaire_type === "proche" && (
          <button
            type="button"
            onClick={() => {
              const url = `${window.location.origin}/dossier-universel/${dossier.id}?shared=true`;
              const message = `Bonjour ${dossier.beneficiaire_prenom || ""} ! J'ai créé ton dossier visa sur VisaCoach. Tu peux suivre et compléter tes documents ici : ${url}`;
              window.open(
                `https://wa.me/?text=${encodeURIComponent(message)}`,
                "_blank",
                "noopener,noreferrer",
              );
            }}
            className="mt-3"
            style={{
              background: "#25D366",
              color: "white",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontWeight: 700,
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            📤 Envoyer le lien à {dossier.beneficiaire_prenom || "votre proche"} via
            WhatsApp
          </button>
        )}

        <div className="mt-4">
          <div className="mb-1 flex justify-between text-sm">
            <span className="font-semibold text-slate-700">Progression</span>
            <span className="font-bold text-slate-800">
              {score}% — {valides}/{total} documents
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${score}%`, backgroundColor: "#F7B731" }}
            />
          </div>
        </div>

        {(risque || dateDepot) && (
          <div className="mt-4 flex flex-wrap gap-2 text-sm">
            {risque && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-semibold text-amber-800">
                Profil de risque : {risque.niveau}
              </span>
            )}
            {dateDepot && (
              <span className="rounded-full bg-brand-50 px-3 py-1 font-semibold text-brand-700">
                Dépôt conseillé :{" "}
                {new Date(dateDepot.date_optimale).toLocaleDateString("fr-FR")}
              </span>
            )}
          </div>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Zones 2 & 3 — Checklist + zone de travail */}
      <div className="grid gap-6 md:grid-cols-[320px_1fr]">
        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
            Checklist officielle
          </h2>
          <ChecklistOfficielle
            items={checklist}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <div>
          {selected ? (
            <ZoneTravail dossierId={id} item={selected} onUploaded={onUploaded} />
          ) : (
            <div className="card text-slate-500">Sélectionnez un document.</div>
          )}
        </div>
      </div>

      {/* Zone 4 — Analyses */}
      {uploadedCount >= 2 ? (
        <AnalyseCoherence dossierId={id} nbDocuments={uploadedCount} />
      ) : (
        <div className="card text-sm text-slate-500">
          🔍 Ajoutez au moins 2 documents pour débloquer l'analyse de cohérence
          consulaire (le différenciateur VisaCoach).
        </div>
      )}
      <div className="grid gap-6 md:grid-cols-2">
        <ProfilRisque result={risque} loading={risqueLoading} onLoad={runRisque} />
        <DateDepot result={dateDepot} loading={dateLoading} onLoad={runDate} />
      </div>

      {/* Martin contextualisé sur le dossier */}
      <MartinChat
        dossierId={id}
        diagnosticData={{
          type_visa: dossier.type_visa,
          pays_destination: dossier.pays_destination,
          pays_origine: dossier.pays_origine,
          score: score,
          plan: dossier.plan,
        }}
        context="dossier"
      />
    </div>
  );
}
