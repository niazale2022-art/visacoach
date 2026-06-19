import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { PAYS_DESTINATION, PAYS_ORIGINE, TYPE_VISA } from "../lib/dossier";

const BLUE = "#1434A4";
const INK = "#0A0F2C";
const SLATE = "#4A5580";

export default function NouveauDossier() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [typeVisa, setTypeVisa] = useState<string | null>(null);
  const [paysDest, setPaysDest] = useState<string | null>(null);
  const [paysOrig, setPaysOrig] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Étape 4 — profil du demandeur (alimente le profil de risque consulaire).
  const [age, setAge] = useState("");
  const [situation, setSituation] = useState("celibataire");
  const [proprietaire, setProprietaire] = useState("non");
  const [historique, setHistorique] = useState("jamais");
  const [emploi, setEmploi] = useState("cdi");

  async function create() {
    if (!typeVisa || !paysDest || !paysOrig) return;
    setCreating(true);
    setError(null);
    try {
      const { dossier_id } = await api.creerDossier({
        type_visa: typeVisa,
        pays_destination: paysDest,
        pays_origine: paysOrig,
        profil: {
          age: age ? Number(age) : undefined,
          situation_familiale: situation,
          proprietaire: proprietaire === "oui",
          historique_voyage: historique,
          statut_emploi: emploi,
        },
      });
      navigate(`/dossier-universel/${dossier_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur de création.");
      setCreating(false);
    }
  }

  if (creating) {
    return <p className="py-20 text-center text-slate-500">Création de votre dossier…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">
      {/* Progression */}
      <div className="mb-8 flex items-center justify-center gap-2">
        {[1, 2, 3, 4].map((s) => (
          <span
            key={s}
            className="h-2 w-12 rounded-full"
            style={{ backgroundColor: s <= step ? BLUE : "#DDE3F5" }}
          />
        ))}
      </div>

      {error && <p className="mb-4 text-center text-sm text-red-600">{error}</p>}

      {/* Étape 1 — Type de visa */}
      {step === 1 && (
        <>
          <h1 className="mb-2 text-center text-3xl font-bold" style={{ color: INK }}>
            Quel type de visa ?
          </h1>
          <p className="mb-8 text-center" style={{ color: SLATE }}>
            Sélectionnez le motif de votre voyage.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {TYPE_VISA.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  setTypeVisa(t.id);
                  setStep(2);
                }}
                className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-5 text-left transition hover:border-brand-400 hover:bg-slate-50"
              >
                <span className="text-3xl">{t.icon}</span>
                <span>
                  <span className="block font-bold" style={{ color: INK }}>
                    {t.label}
                  </span>
                  <span className="text-sm" style={{ color: SLATE }}>
                    {t.desc}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </>
      )}

      {/* Étape 2 — Pays de destination */}
      {step === 2 && (
        <>
          <h1 className="mb-2 text-center text-3xl font-bold" style={{ color: INK }}>
            Pays de destination ?
          </h1>
          <p className="mb-8 text-center" style={{ color: SLATE }}>
            Où souhaitez-vous vous rendre ?
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PAYS_DESTINATION.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPaysDest(p.id);
                  setStep(3);
                }}
                className="rounded-2xl border border-slate-200 bg-white p-4 text-center transition hover:border-brand-400 hover:bg-slate-50"
              >
                <span className="text-3xl">{p.flag}</span>
                <span className="mt-2 block font-bold" style={{ color: INK }}>
                  {p.label}
                </span>
                <span className="text-xs" style={{ color: SLATE }}>
                  {p.zone}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(1)}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Retour
          </button>
        </>
      )}

      {/* Étape 3 — Pays d'origine */}
      {step === 3 && (
        <>
          <h1 className="mb-2 text-center text-3xl font-bold" style={{ color: INK }}>
            Votre pays d'origine ?
          </h1>
          <p className="mb-8 text-center" style={{ color: SLATE }}>
            D'où déposez-vous votre demande ?
          </p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PAYS_ORIGINE.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  setPaysOrig(p.id);
                  setStep(4);
                }}
                className={`rounded-xl border bg-white p-3 text-center transition hover:border-brand-400 hover:bg-slate-50 ${
                  paysOrig === p.id ? "border-brand-600" : "border-slate-200"
                }`}
              >
                <span className="text-2xl">{p.flag}</span>
                <span className="mt-1 block text-sm font-semibold" style={{ color: INK }}>
                  {p.label}
                </span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStep(2)}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Retour
          </button>
        </>
      )}

      {/* Étape 4 — Profil du demandeur */}
      {step === 4 && (
        <>
          <h1 className="mb-2 text-center text-3xl font-bold" style={{ color: INK }}>
            Votre profil
          </h1>
          <p className="mb-8 text-center" style={{ color: SLATE }}>
            Ces informations affinent votre profil de risque consulaire.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="card space-y-4"
          >
            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: SLATE }}>
                Âge
              </label>
              <input
                type="number"
                min={16}
                max={99}
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-brand-500 focus:outline-none"
                placeholder="Ex. 28"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: SLATE }}>
                Situation familiale
              </label>
              <select
                value={situation}
                onChange={(e) => setSituation(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="celibataire">Célibataire</option>
                <option value="marie">Marié(e)</option>
                <option value="enfants">Marié(e) avec enfants</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: SLATE }}>
                Êtes-vous propriétaire ?
              </label>
              <select
                value={proprietaire}
                onChange={(e) => setProprietaire(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="non">Non</option>
                <option value="oui">Oui</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: SLATE }}>
                Historique de voyage
              </label>
              <select
                value={historique}
                onChange={(e) => setHistorique(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="jamais">Jamais voyagé</option>
                <option value="quelques_pays">Quelques pays</option>
                <option value="regulier">Voyageur régulier</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold" style={{ color: SLATE }}>
                Statut d'emploi
              </label>
              <select
                value={emploi}
                onChange={(e) => setEmploi(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-4 py-2 focus:border-brand-500 focus:outline-none"
              >
                <option value="cdi">Salarié (CDI)</option>
                <option value="cdd">Salarié (CDD)</option>
                <option value="independant">Indépendant</option>
                <option value="sans_emploi">Sans emploi</option>
                <option value="etudiant">Étudiant</option>
              </select>
            </div>

            <button type="submit" className="btn-primary w-full">
              Créer mon dossier →
            </button>
          </form>

          <button
            type="button"
            onClick={() => setStep(3)}
            className="mt-6 text-sm text-slate-500 hover:text-slate-700"
          >
            ← Retour
          </button>
        </>
      )}
    </div>
  );
}
