import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import ChecklistOfficielle from "../components/dossier/ChecklistOfficielle";
import ZoneTravail from "../components/dossier/ZoneTravail";
import AnalyseCoherence from "../components/dossier/AnalyseCoherence";
import ProfilRisque from "../components/dossier/ProfilRisque";
import DateDepot from "../components/dossier/DateDepot";
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
      {/* Zone 1 — En-tête */}
      <div className="card">
        <h1 className="text-2xl font-bold text-slate-900">
          {v.icon} Visa {v.label} · {dest.flag} {dest.label}
        </h1>
        <p className="text-sm text-slate-500">
          Depuis : {orig.flag} {orig.label}
        </p>

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
    </div>
  );
}
