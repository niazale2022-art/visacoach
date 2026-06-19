import { useEffect, useState } from "react";
import { api, type CoherenceAnalyse } from "../../lib/api";

interface AnalyseCoherenceProps {
  dossierId: string;
  nbDocuments: number;
}

const NIVEAU_CONFIG: Record<string, { color: string; bg: string; label: string; icon: string }> = {
  EXCELLENT: { color: "#16A34A", bg: "#DCFCE7", label: "Excellent", icon: "🟢" },
  BON: { color: "#2563EB", bg: "#DBEAFE", label: "Bon", icon: "🔵" },
  MOYEN: { color: "#D97706", bg: "#FEF3C7", label: "Moyen", icon: "🟡" },
  FAIBLE: { color: "#DC2626", bg: "#FEE2E2", label: "Faible", icon: "🔴" },
  CRITIQUE: { color: "#7C3AED", bg: "#EDE9FE", label: "Critique", icon: "🚨" },
};

const VERDICT_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  FAVORABLE: { color: "#16A34A", label: "Favorable", icon: "✅" },
  RESERVE: { color: "#D97706", label: "Réservé", icon: "⚠️" },
  DEFAVORABLE: { color: "#DC2626", label: "Défavorable", icon: "❌" },
};

const IMPACT_COLOR: Record<string, string> = {
  BLOQUANT: "#B91C1C",
  MAJEUR: "#DC2626",
  MINEUR: "#D97706",
};

/**
 * Analyse de cohérence consulaire inter-documents (auto-gérée).
 */
export default function AnalyseCoherence({ dossierId, nbDocuments }: AnalyseCoherenceProps) {
  const [analyse, setAnalyse] = useState<CoherenceAnalyse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charge l'analyse existante au montage.
  useEffect(() => {
    api
      .getAnalyseCoherence(dossierId)
      .then((r) => {
        if (r.pret) setAnalyse(r);
      })
      .catch(() => {});
  }, [dossierId]);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await api.analyseCoherence(dossierId);
      if (!r.pret) setError(r.message ?? "Analyse indisponible.");
      else setAnalyse(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur d'analyse.");
    } finally {
      setLoading(false);
    }
  }

  const niveau = analyse?.niveau ? NIVEAU_CONFIG[analyse.niveau] : null;
  const verdict = analyse?.verdict_consul ? VERDICT_CONFIG[analyse.verdict_consul] : null;

  return (
    <div className="card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            🔍 Analyse consulaire de votre dossier
          </h2>
          <p className="text-sm text-slate-500">
            {nbDocuments} document{nbDocuments > 1 ? "s" : ""} seront analysés ensemble.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          className="btn-primary !px-5 !py-2.5 text-sm disabled:opacity-60"
        >
          {loading
            ? "Analyse en cours… (20-30 s)"
            : analyse
              ? "Relancer l'analyse"
              : "Analyser la cohérence du dossier"}
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {analyse && analyse.pret && (
        <div className="mt-5 space-y-5">
          {/* Verdict */}
          <div
            className="rounded-2xl p-5"
            style={{ backgroundColor: niveau?.bg ?? "#F4F6FC" }}
          >
            <div className="flex flex-wrap items-center gap-4">
              <div>
                <span className="text-3xl font-extrabold" style={{ color: niveau?.color }}>
                  {analyse.score_coherence}
                  <span className="text-base text-slate-400">/100</span>
                </span>
                <p className="text-xs font-semibold" style={{ color: niveau?.color }}>
                  Cohérence {niveau?.label ?? analyse.niveau}
                </p>
              </div>
              {verdict && (
                <div>
                  <span className="text-lg font-bold" style={{ color: verdict.color }}>
                    {verdict.icon} Verdict : {verdict.label}
                  </span>
                  {typeof analyse.probabilite_accord === "number" && (
                    <p className="text-sm text-slate-600">
                      Probabilité d'accord estimée : <b>{analyse.probabilite_accord}%</b>
                    </p>
                  )}
                </div>
              )}
            </div>
            {analyse.resume_consul && (
              <p className="mt-3 text-sm italic text-slate-700">
                💬 « {analyse.resume_consul} »
              </p>
            )}
          </div>

          {/* Incohérences critiques */}
          {analyse.incoherences_critiques && analyse.incoherences_critiques.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold text-slate-800">❌ Incohérences détectées</h3>
              <div className="space-y-3">
                {analyse.incoherences_critiques.map((inc, i) => (
                  <div key={i} className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-red-800">{inc.titre}</span>
                      {inc.impact && (
                        <span
                          className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                          style={{ backgroundColor: IMPACT_COLOR[inc.impact] ?? "#DC2626" }}
                        >
                          {inc.impact}
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-slate-700">{inc.description}</p>
                    {inc.documents_impliques?.length > 0 && (
                      <p className="mt-1 text-xs text-slate-500">
                        Documents : {inc.documents_impliques.join(", ")}
                      </p>
                    )}
                    {inc.solution && (
                      <p className="mt-2 text-sm text-green-700">✅ {inc.solution}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points de vigilance */}
          {analyse.points_vigilance && analyse.points_vigilance.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold text-slate-800">⚠️ Points de vigilance</h3>
              <div className="space-y-2">
                {analyse.points_vigilance.map((v, i) => (
                  <div key={i} className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                    <p className="font-semibold text-amber-800">{v.titre}</p>
                    <p className="text-sm text-slate-700">{v.description}</p>
                    {v.conseil && <p className="mt-1 text-sm text-slate-600">💡 {v.conseil}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Points forts */}
          {analyse.points_forts && analyse.points_forts.length > 0 && (
            <div>
              <h3 className="mb-2 font-bold text-slate-800">✅ Points forts</h3>
              <ul className="space-y-1 text-sm text-slate-700">
                {analyse.points_forts.map((p, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-green-600">•</span>
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Recommandations */}
          {analyse.recommandations_prioritaires &&
            analyse.recommandations_prioritaires.length > 0 && (
              <div>
                <h3 className="mb-2 font-bold text-slate-800">🎯 Recommandations prioritaires</h3>
                <ol className="space-y-2">
                  {analyse.recommandations_prioritaires.map((r, i) => (
                    <li key={i} className="rounded-xl bg-slate-50 p-3 text-sm">
                      <span className="font-semibold text-slate-800">
                        {r.priorite}. {r.action}
                      </span>
                      {r.urgence && (
                        <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-xs font-semibold text-brand-700">
                          {r.urgence}
                        </span>
                      )}
                      {r.raison && <p className="mt-1 text-slate-600">{r.raison}</p>}
                    </li>
                  ))}
                </ol>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
