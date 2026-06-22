import { useState } from "react";
import { api, type Plan, type Provider } from "../lib/api";

interface PaymentModalProps {
  diagnosticId: string;
  email: string;
  fullName?: string;
  onClose: () => void;
}

const PLANS: {
  id: Plan;
  title: string;
  fcfa: string;
  eur: string;
  features: string[];
}[] = [
  {
    id: "rapport",
    title: "Rapport Martin",
    fcfa: "65 000 FCFA",
    eur: "99 €",
    features: [
      "Analyse détaillée de votre profil",
      "Points forts et points de vigilance",
      "Plan d'action priorisé",
      "Rapport rédigé par Martin, reçu par email",
    ],
  },
  {
    id: "suivi",
    title: "Pack Dossier",
    fcfa: "130 000 FCFA",
    eur: "199 €",
    features: [
      "Tout le Rapport Martin",
      "Vérification de chaque document",
      "Analyse de cohérence consulaire",
      "Lettres générées + calendrier de dépôt",
    ],
  },
];

/**
 * Modale de paiement : choix de l'offre puis du moyen de paiement
 * (CinetPay pour l'Afrique en FCFA, Stripe pour la diaspora en EUR).
 */
export default function PaymentModal({
  diagnosticId,
  email,
  fullName,
  onClose,
}: PaymentModalProps) {
  const [plan, setPlan] = useState<Plan>("rapport");
  const [loading, setLoading] = useState<Provider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function pay(provider: Provider) {
    setLoading(provider);
    setError(null);
    try {
      const result = await api.checkout(provider, {
        diagnostic_id: diagnosticId,
        email,
        plan,
        full_name: fullName,
      });
      // On mémorise le diagnostic pour le retrouver au retour du paiement
      // (les URLs de retour des prestataires ne le transportent pas toujours).
      localStorage.setItem("visacoach_diagnostic_id", diagnosticId);
      // Redirection vers la page de paiement hébergée.
      window.location.href = result.payment_url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de paiement.");
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-start justify-between">
          <h2 className="text-2xl font-bold text-slate-800">
            Débloquez votre rapport
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-2xl leading-none text-slate-400 hover:text-slate-600"
            aria-label="Fermer"
          >
            &times;
          </button>
        </div>

        {/* Choix de l'offre */}
        <div className="mb-6 grid gap-4 sm:grid-cols-2">
          {PLANS.map((p) => {
            const active = plan === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlan(p.id)}
                className={`rounded-2xl border-2 p-5 text-left transition ${
                  active
                    ? "border-brand-600 bg-brand-50"
                    : "border-slate-200 hover:border-brand-300"
                }`}
              >
                <h3 className="text-lg font-bold text-slate-800">{p.title}</h3>
                <p className="mt-1 text-2xl font-extrabold text-brand-700">
                  {p.fcfa}
                </p>
                <p className="text-sm text-slate-500">≈ {p.eur}</p>
                <ul className="mt-3 space-y-1 text-sm text-slate-600">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2">
                      <span className="text-brand-600">✓</span>
                      {f}
                    </li>
                  ))}
                </ul>
              </button>
            );
          })}
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {/* Moyens de paiement */}
        <div className="space-y-3">
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => pay("cinetpay")}
            className="btn-primary w-full"
          >
            {loading === "cinetpay"
              ? "Redirection…"
              : "Payer en FCFA (Wave, Orange Money, MTN, carte)"}
          </button>
          <button
            type="button"
            disabled={loading !== null}
            onClick={() => pay("stripe")}
            className="btn-secondary w-full"
          >
            {loading === "stripe" ? "Redirection…" : "Payer en € (carte bancaire)"}
          </button>
        </div>

        <p className="mt-4 text-center text-xs text-slate-400">
          Paiement sécurisé. Aucune garantie d'obtention du visa : VisaCoach est
          un accompagnement méthodologique.
        </p>
      </div>
    </div>
  );
}
