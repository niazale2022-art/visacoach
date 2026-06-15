import { useEffect, useState, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";

// Palette (direction artistique inspirée visa.com)
const C = {
  blue: "#1434A4",
  blueMid: "#1A52C8",
  blueLight: "#EBF0FF",
  gold: "#F7B731",
  goldDark: "#D4961A",
  white: "#FFFFFF",
  ink: "#0A0F2C",
  slate: "#4A5580",
  mist: "#F4F6FC",
  border: "#DDE3F5",
};

const serif: CSSProperties = { fontFamily: "'Merriweather', Georgia, serif" };
const heroGradient: CSSProperties = {
  background: `linear-gradient(135deg, ${C.blue} 0%, ${C.blueMid} 100%)`,
};

// --- Données de contenu -----------------------------------------------------
const COUNTRIES = ["🇸🇳", "🇨🇮", "🇨🇲", "🇲🇱", "🇨🇬"];
const PAY_BADGES = ["Wave", "Orange Money", "MTN MoMo", "Carte"];

const TRUST: { value: string; label: string }[] = [
  { value: "2 400+", label: "dossiers analysés" },
  { value: "25", label: "pays couverts" },
  { value: "3 min", label: "pour le diagnostic" },
  { value: "Mobile money", label: "accepté" },
  { value: "4,8/5", label: "satisfaction" },
];

const PROCESS: { n: number; title: string; text: string }[] = [
  { n: 1, title: "Diagnostic gratuit", text: "7 questions ciblées sur votre profil et votre projet." },
  { n: 2, title: "Score & rapport", text: "Votre score 0-100 et un plan d'action personnalisé." },
  { n: 3, title: "Constitution du dossier", text: "Uploadez vos documents, l'IA les vérifie un par un." },
  { n: 4, title: "Dépôt en confiance", text: "Lettre générée et conseils pour l'entretien consulaire." },
];

const FEATURES: { icon: string; title: string; text: string }[] = [
  { icon: "🎯", title: "Analyse IA personnalisée", text: "Un diagnostic adapté à votre pays, votre profil et votre motif de voyage." },
  { icon: "📄", title: "Vérification de documents", text: "Chaque pièce est contrôlée par l'IA, avec un feedback concret." },
  { icon: "✍️", title: "Génération de lettres", text: "Lettre de motivation et d'invitation rédigées pour vous." },
  { icon: "🗣️", title: "Conseils d'entretien", text: "Questions probables et réponses suggérées pour le consulat." },
  { icon: "📱", title: "100% mobile", text: "Tout fonctionne depuis votre smartphone, où que vous soyez." },
  { icon: "🔒", title: "Données sécurisées", text: "Vos documents sont stockés de façon privée et chiffrée." },
];

const OPERATORS: { name: string; icon: string }[] = [
  { name: "Wave", icon: "🌊" },
  { name: "Orange Money", icon: "🟠" },
  { name: "MTN MoMo", icon: "🟡" },
  { name: "Carte Visa / Mastercard", icon: "💳" },
];

const TESTIMONIALS: {
  name: string;
  country: string;
  pay: string;
  color: string;
  text: string;
}[] = [
  {
    name: "Awa D.",
    country: "Sénégal 🇸🇳",
    pay: "Payé via Wave",
    color: "#1A52C8",
    text: "Le rapport m'a montré exactement quoi corriger. Visa obtenu du premier coup !",
  },
  {
    name: "Kévin M.",
    country: "Côte d'Ivoire 🇨🇮",
    pay: "Payé via Orange Money",
    color: "#D4961A",
    text: "La vérification des documents par l'IA m'a évité une erreur sur mes relevés.",
  },
  {
    name: "Blaise N.",
    country: "Cameroun 🇨🇲",
    pay: "Payé par carte",
    color: "#0A0F2C",
    text: "La lettre de motivation générée était parfaite. Un vrai gain de temps.",
  },
];

const FAQS: { q: string; a: string }[] = [
  {
    q: "Puis-je payer en FCFA avec mobile money ?",
    a: "Oui. Nous acceptons Wave, Orange Money, MTN MoMo et la carte bancaire. La diaspora peut payer en euros par carte.",
  },
  {
    q: "VisaCoach garantit-il l'obtention du visa ?",
    a: "Non. VisaCoach est un accompagnement méthodologique qui maximise vos chances, mais la décision finale appartient au consulat.",
  },
  {
    q: "Faut-il créer un compte ?",
    a: "Non, le diagnostic est accessible sans inscription. Votre email sert uniquement à recevoir votre rapport.",
  },
  {
    q: "Quels pays sont couverts ?",
    a: "Nous accompagnons les ressortissants d'Afrique subsaharienne francophone vers l'espace Schengen, le Canada et d'autres destinations.",
  },
  {
    q: "Et si j'ai déjà eu un refus ?",
    a: "Le diagnostic en tient compte et le rapport vous indique précisément les points à renforcer pour votre nouvelle demande.",
  },
];

const REFUS_REASONS: { pct: string; label: string; color: string }[] = [
  { pct: "42%", label: "Dossier incomplet ou documents manquants", color: "#DC2626" },
  { pct: "31%", label: "Justificatifs financiers insuffisants", color: "#EA580C" },
  { pct: "18%", label: "Liens insuffisants avec le pays d'origine", color: "#D97706" },
  { pct: "12%", label: "Incohérences dans le dossier", color: "#CA8A04" },
  { pct: "8%", label: "Historique de voyage inexistant", color: "#65A30D" },
];

const DELAIS: {
  pays: string;
  consulat: string;
  visa: string;
  delai: string;
  taux: number;
}[] = [
  { pays: "🇸🇳 Sénégal", consulat: "Dakar", visa: "Schengen France", delai: "10-15 jours", taux: 41 },
  { pays: "🇨🇮 Côte d'Ivoire", consulat: "Abidjan", visa: "Schengen France", delai: "8-12 jours", taux: 37 },
  { pays: "🇨🇲 Cameroun", consulat: "Yaoundé", visa: "Schengen France", delai: "12-20 jours", taux: 44 },
  { pays: "🇲🇱 Mali", consulat: "Bamako", visa: "Schengen France", delai: "15-25 jours", taux: 52 },
  { pays: "🇨🇬 Congo", consulat: "Brazzaville", visa: "Schengen France", delai: "10-18 jours", taux: 39 },
];

// Couleur du taux de refus : >45% rouge, 35-45% orange, <35% vert.
function tauxColor(taux: number): string {
  if (taux > 45) return "#DC2626";
  if (taux >= 35) return "#EA580C";
  return "#16A34A";
}

// --- Composant --------------------------------------------------------------
export default function Home() {
  const navigate = useNavigate();
  const goDiagnostic = () => navigate("/diagnostic");

  // Animation de la barre de score
  const [scoreWidth, setScoreWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setScoreWidth(61), 250);
    return () => clearTimeout(t);
  }, []);

  // Accordéon FAQ
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // La Home est rendue dans une <main> pleine largeur (voir App.tsx) :
  // un simple conteneur suffit, pas de marges négatives ni de 100vw.
  const fullBleed: CSSProperties = {
    width: "100%",
    overflowX: "hidden",
  };

  const goldBtn: CSSProperties = {
    backgroundColor: C.gold,
    color: C.ink,
  };

  return (
    <div style={fullBleed}>
      {/* ============================ HERO ============================ */}
      <section style={heroGradient}>
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
          {/* Texte */}
          <div className="order-2 md:order-1">
            <h1
              className="text-4xl font-bold leading-tight text-white sm:text-5xl"
              style={serif}
            >
              Maximisez vos chances d'obtenir votre visa
            </h1>
            <p className="mt-5 max-w-lg text-lg text-white/85">
              Diagnostic gratuit, rapport personnalisé par IA et constitution de
              dossier assistée — pensé pour l'Afrique francophone.
            </p>

            {/* Badges pays */}
            <div className="mt-6 flex items-center gap-2 text-2xl">
              {COUNTRIES.map((c) => (
                <span key={c}>{c}</span>
              ))}
              <span className="ml-1 text-sm text-white/70">et plus</span>
            </div>

            {/* Badges mobile money */}
            <div className="mt-4 flex flex-wrap gap-2">
              {PAY_BADGES.map((b) => (
                <span
                  key={b}
                  className="rounded-lg px-3 py-1 text-xs font-semibold text-white"
                  style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                >
                  {b}
                </span>
              ))}
            </div>

            {/* CTA */}
            <button
              type="button"
              onClick={goDiagnostic}
              className="mt-8 rounded-xl px-7 py-4 text-base font-bold shadow-lg transition hover:brightness-95"
              style={goldBtn}
            >
              Analyser mon dossier gratuitement →
            </button>
          </div>

          {/* Carte score (au-dessus sur mobile) */}
          <div className="order-1 md:order-2">
            <div className="mx-auto max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
              <div className="flex items-end justify-between">
                <span className="text-sm font-semibold" style={{ color: C.slate }}>
                  Score de votre dossier
                </span>
                <span className="text-3xl font-extrabold" style={{ color: C.blue }}>
                  61<span className="text-base text-slate-400">/100</span>
                </span>
              </div>

              <div className="mt-3 h-3 w-full overflow-hidden rounded-full" style={{ backgroundColor: C.mist }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${scoreWidth}%`,
                    backgroundColor: C.gold,
                    transition: "width 1.2s ease",
                  }}
                />
              </div>

              <ul className="mt-5 space-y-3 text-sm">
                <li className="flex items-center gap-2 text-slate-700">
                  <span className="text-green-600">✓</span> Passeport valide
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  <span className="text-green-600">✓</span> Photo d'identité conforme
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  <span style={{ color: C.goldDark }}>⚠️</span> Relevé bancaire à renforcer
                </li>
                <li className="flex items-center gap-2 text-slate-700">
                  <span style={{ color: C.goldDark }}>⚠️</span> Lettre de motivation à préciser
                </li>
                <li
                  className="flex select-none items-center gap-2 text-slate-400"
                  style={{ filter: "blur(3px)" }}
                >
                  <span>🔒</span> Réservation de vol — analyse complète
                </li>
              </ul>

              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-xl font-extrabold" style={{ color: C.ink }}>
                  6 500 FCFA
                </span>
                <span className="text-sm text-slate-400">≈ 9,90 €</span>
              </div>

              <button
                type="button"
                onClick={goDiagnostic}
                className="mt-3 w-full rounded-xl py-3 font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: C.blue }}
              >
                Débloquer le rapport complet
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* ======================= BANDEAU GARANTIE ======================= */}
      <div
        style={{
          background: "#DCFCE7",
          borderTop: "1px solid #BBF7D0",
          borderBottom: "1px solid #BBF7D0",
          padding: "14px 5%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "32px",
          flexWrap: "wrap",
        }}
      >
        {[
          "🛡️ Satisfait ou remboursé sous 7 jours",
          "📋 Basé sur les critères officiels des ambassades",
          "🔒 Données chiffrées et privées",
        ].map((item) => (
          <span
            key={item}
            style={{
              fontSize: "0.85rem",
              color: "#15803D",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            {item}
          </span>
        ))}
      </div>

      {/* ========================== TRUST BAR ========================== */}
      <section style={{ backgroundColor: C.mist }}>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-6 px-4 py-8 text-center sm:grid-cols-3 md:grid-cols-5">
          {TRUST.map((t) => (
            <div key={t.label}>
              <div className="text-xl font-extrabold" style={{ color: C.blue }}>
                {t.value}
              </div>
              <div className="text-xs" style={{ color: C.slate }}>
                {t.label}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===================== STATS REFUS CONSULAIRES ===================== */}
      <section className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Pourquoi autant de visas sont refusés ?
          </h2>
          <p className="mx-auto mt-3 max-w-2xl text-center" style={{ color: C.slate }}>
            Les consulats rejettent 35 à 45 % des demandes d'Afrique francophone.
            Voici les vraies raisons.
          </p>

          <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {REFUS_REASONS.map((r) => (
              <div
                key={r.label}
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: C.mist, border: `1px solid ${C.border}` }}
              >
                <div className="text-4xl font-extrabold" style={{ color: r.color }}>
                  {r.pct}
                </div>
                <p className="mt-3 text-sm" style={{ color: C.slate }}>
                  {r.label}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Source : données compilées à partir des rapports consulaires officiels
            2023-2024
          </p>

          <div className="mt-8 text-center">
            <p className="mb-4 font-semibold" style={{ color: C.ink }}>
              VisaCoach détecte ces erreurs avant votre dépôt.
            </p>
            <button
              type="button"
              onClick={goDiagnostic}
              className="rounded-xl px-7 py-4 text-base font-bold shadow-lg transition hover:brightness-95"
              style={goldBtn}
            >
              Analyser mon dossier →
            </button>
          </div>
        </div>
      </section>

      {/* =========================== PROCESS =========================== */}
      <section id="process" className="bg-white">
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Comment ça marche
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-center" style={{ color: C.slate }}>
            De l'évaluation au dépôt, on vous guide à chaque étape.
          </p>

          <div className="mt-12 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {PROCESS.map((step) => (
              <div key={step.n} className="text-center">
                <div
                  className="mx-auto flex h-14 w-14 items-center justify-center rounded-full text-xl font-extrabold text-white"
                  style={{ backgroundColor: C.blue }}
                >
                  {step.n}
                </div>
                <h3 className="mt-4 font-bold" style={{ color: C.ink }}>
                  {step.title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: C.slate }}>
                  {step.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =========================== FEATURES =========================== */}
      <section style={{ backgroundColor: C.mist }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Tout ce qu'il vous faut
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="rounded-2xl bg-white p-6 shadow-sm"
                style={{ border: `1px solid ${C.border}` }}
              >
                <div className="text-3xl">{f.icon}</div>
                <h3 className="mt-4 font-bold" style={{ color: C.ink }}>
                  {f.title}
                </h3>
                <p className="mt-2 text-sm" style={{ color: C.slate }}>
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== APERÇU RAPPORT FLOUTÉ ====================== */}
      <section style={{ backgroundColor: C.mist }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Voici ce que contient votre rapport
          </h2>
          <p className="mt-2 text-center" style={{ color: C.slate }}>
            Débloquez l'analyse complète pour 6 500 FCFA
          </p>

          <div style={{ position: "relative", maxWidth: "700px", margin: "32px auto 0" }}>
            <div
              style={{
                position: "relative",
                background: "white",
                borderRadius: "16px",
                padding: "28px",
                border: `1px solid ${C.border}`,
                overflow: "hidden",
              }}
            >
              <h3 className="font-bold" style={{ color: C.ink }}>
                📋 Rapport Visa — Profil Cameroun → France
              </h3>
              <div style={{ color: C.blue, fontSize: "2rem", fontWeight: 800 }}>
                66 / 100
              </div>
              <p style={{ color: C.slate, fontSize: "0.85rem", marginBottom: "16px" }}>
                Niveau Bon — Dossier renforçable
              </p>

              <div className="space-y-1 text-sm" style={{ color: C.ink }}>
                <div>✅ Capacité financière solide</div>
                <div>✅ Motif de voyage cohérent</div>
              </div>

              {/* Partie floutée */}
              <div
                style={{
                  filter: "blur(5px)",
                  userSelect: "none",
                  pointerEvents: "none",
                  marginTop: "16px",
                }}
                className="space-y-2 text-sm"
                aria-hidden="true"
              >
                <div>⚠️ Point faible critique détecté sur votre statut professionnel…</div>
                <div>🔴 PRIORITÉ 1 — Action immédiate requise sur vos justificatifs…</div>
                <div>📋 Liste complète de 8 documents personnalisés pour votre profil…</div>
                <div>📅 Calendrier semaine par semaine pour votre dépôt…</div>
                <div>🗣️ 12 questions probables à l'entretien consulaire…</div>
              </div>

              {/* Overlay cadenas */}
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: "60%",
                  background:
                    "linear-gradient(to bottom, transparent, rgba(244,246,252,0.97))",
                  borderRadius: "0 0 16px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "flex-end",
                  paddingBottom: "28px",
                  gap: "12px",
                }}
              >
                <div style={{ fontSize: "2rem" }}>🔒</div>
                <div style={{ fontWeight: 700, color: C.ink }}>
                  Débloquer l'analyse complète
                </div>
                <button
                  type="button"
                  onClick={goDiagnostic}
                  style={{
                    background: C.gold,
                    color: C.ink,
                    border: "none",
                    padding: "12px 28px",
                    borderRadius: "8px",
                    fontWeight: 800,
                    cursor: "pointer",
                    fontSize: "0.9rem",
                  }}
                >
                  Voir mon rapport — 6 500 FCFA →
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== PRICING =========================== */}
      <section id="pricing" style={{ backgroundColor: C.ink }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold text-white" style={serif}>
            Des tarifs adaptés
          </h2>
          <p className="mt-2 text-center text-white/70">
            Payez en FCFA (mobile money) ou en euros (carte).
          </p>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {/* Gratuit */}
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-bold text-white">Diagnostic</h3>
              <p className="mt-2 text-3xl font-extrabold text-white">Gratuit</p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>✓ Score 0-100</li>
                <li>✓ Résumé de votre profil</li>
                <li>✓ Sans inscription</li>
              </ul>
              <button
                type="button"
                onClick={goDiagnostic}
                className="mt-6 w-full rounded-xl border border-white/30 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Commencer
              </button>
            </div>

            {/* Rapport (featured) */}
            <div
              className="relative rounded-2xl bg-white p-6 shadow-2xl"
              style={{ border: `2px solid ${C.gold}` }}
            >
              <span
                className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3 py-1 text-xs font-bold"
                style={goldBtn}
              >
                Le plus choisi
              </span>
              <h3 className="text-lg font-bold" style={{ color: C.ink }}>
                Rapport complet
              </h3>
              <p className="mt-2 text-3xl font-extrabold" style={{ color: C.blue }}>
                6 500 FCFA
              </p>
              <p className="text-sm text-slate-400">≈ 9,90 €</p>
              <ul className="mt-4 space-y-2 text-sm" style={{ color: C.slate }}>
                <li>✓ Analyse détaillée du profil</li>
                <li>✓ Plan d'action priorisé</li>
                <li>✓ Rapport reçu par email</li>
              </ul>
              <button
                type="button"
                onClick={goDiagnostic}
                className="mt-6 w-full rounded-xl py-3 font-bold text-white transition hover:brightness-110"
                style={{ backgroundColor: C.blue }}
              >
                Choisir ce plan
              </button>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {PAY_BADGES.map((b) => (
                  <span
                    key={b}
                    className="rounded px-2 py-0.5 text-[10px] font-semibold"
                    style={{ backgroundColor: C.blueLight, color: C.blue }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>

            {/* Suivi Expert */}
            <div className="rounded-2xl bg-white/5 p-6 ring-1 ring-white/10">
              <h3 className="text-lg font-bold text-white">Suivi Expert</h3>
              <p className="mt-2 text-3xl font-extrabold text-white">19 600 FCFA</p>
              <p className="text-sm text-white/50">≈ 29,90 €</p>
              <ul className="mt-4 space-y-2 text-sm text-white/75">
                <li>✓ Tout le Rapport complet</li>
                <li>✓ Calendrier semaine par semaine</li>
                <li>✓ Accompagnement personnalisé</li>
              </ul>
              <button
                type="button"
                onClick={goDiagnostic}
                className="mt-6 w-full rounded-xl py-3 font-bold transition hover:brightness-95"
                style={goldBtn}
              >
                Choisir ce plan
              </button>
              <div className="mt-3 flex flex-wrap justify-center gap-1">
                {PAY_BADGES.map((b) => (
                  <span
                    key={b}
                    className="rounded px-2 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: "rgba(255,255,255,0.12)" }}
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================== PAIEMENT =========================== */}
      <section style={{ backgroundColor: C.blueLight }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Payez comme vous voulez
          </h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {OPERATORS.map((op) => (
              <div
                key={op.name}
                className="flex flex-col items-center rounded-2xl bg-white p-6 text-center shadow-sm"
              >
                <span className="text-4xl">{op.icon}</span>
                <span className="mt-3 font-bold" style={{ color: C.ink }}>
                  {op.name}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-6 text-center text-sm" style={{ color: C.slate }}>
            Taux de change indicatif : 1 € = 655 FCFA
          </p>
        </div>
      </section>

      {/* ========================= TÉMOIGNAGES ========================= */}
      <section style={{ backgroundColor: C.mist }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Ils ont obtenu leur visa
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl bg-white p-6 shadow-sm">
                <p className="text-sm italic" style={{ color: C.slate }}>
                  « {t.text} »
                </p>
                <div className="mt-5 flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <div className="font-bold" style={{ color: C.ink }}>
                      {t.name}
                    </div>
                    <div className="text-xs" style={{ color: C.slate }}>
                      {t.country} · {t.pay}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ====================== DÉLAIS CONSULAIRES ====================== */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Délais consulaires actuels
          </h2>
          <p className="mt-2 text-center" style={{ color: C.slate }}>
            Planifiez votre demande en tenant compte des délais réels.
          </p>

          <div className="mt-10 overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr style={{ backgroundColor: C.blueLight, color: C.blue }}>
                  <th className="rounded-l-lg px-4 py-3 text-left font-bold">Pays</th>
                  <th className="px-4 py-3 text-left font-bold">Consulat</th>
                  <th className="px-4 py-3 text-left font-bold">Visa</th>
                  <th className="px-4 py-3 text-left font-bold">Délai moyen</th>
                  <th className="rounded-r-lg px-4 py-3 text-left font-bold">
                    Taux de refus
                  </th>
                </tr>
              </thead>
              <tbody>
                {DELAIS.map((d) => (
                  <tr key={d.pays} style={{ borderBottom: `1px solid ${C.border}` }}>
                    <td className="px-4 py-3 font-semibold" style={{ color: C.ink }}>
                      {d.pays}
                    </td>
                    <td className="px-4 py-3" style={{ color: C.slate }}>
                      {d.consulat}
                    </td>
                    <td className="px-4 py-3" style={{ color: C.slate }}>
                      {d.visa}
                    </td>
                    <td className="px-4 py-3" style={{ color: C.slate }}>
                      {d.delai}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="rounded-full px-3 py-1 text-xs font-bold text-white"
                        style={{ backgroundColor: tauxColor(d.taux) }}
                      >
                        {d.taux}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            Données indicatives basées sur les retours de nos utilisateurs —
            2024-2025
          </p>
        </div>
      </section>

      {/* ============================= FAQ ============================= */}
      <section id="faq" className="bg-white">
        <div className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Questions fréquentes
          </h2>
          <div className="mt-10 space-y-3">
            {FAQS.map((faq, i) => {
              const open = openFaq === i;
              return (
                <div
                  key={faq.q}
                  className="rounded-xl bg-white"
                  style={{ border: `1px solid ${C.border}` }}
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-semibold"
                    style={{ color: C.ink }}
                  >
                    {faq.q}
                    <span style={{ color: C.blue }}>{open ? "−" : "+"}</span>
                  </button>
                  {open && (
                    <p className="px-5 pb-4 text-sm" style={{ color: C.slate }}>
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ========================== FINAL CTA ========================== */}
      <section style={heroGradient}>
        <div className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h2 className="text-4xl font-bold text-white" style={serif}>
            Votre visa commence ici.
          </h2>
          <p className="mt-4 text-lg text-white/85">
            Lancez votre diagnostic gratuit en 3 minutes.
          </p>
          <button
            type="button"
            onClick={goDiagnostic}
            className="mt-8 rounded-xl px-8 py-4 text-base font-bold shadow-lg transition hover:brightness-95"
            style={goldBtn}
          >
            Analyser mon dossier gratuitement →
          </button>
        </div>
      </section>
    </div>
  );
}
