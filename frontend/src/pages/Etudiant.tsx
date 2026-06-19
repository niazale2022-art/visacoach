import { useNavigate } from "react-router-dom";

const C = {
  blue: "#1434A4",
  blueMid: "#1A52C8",
  gold: "#F7B731",
  ink: "#0A0F2C",
  slate: "#4A5580",
  mist: "#F4F6FC",
  border: "#DDE3F5",
};
const serif = { fontFamily: "'Merriweather', Georgia, serif" } as const;

const MODULES = [
  { icon: "🎓", title: "Choix d'université", text: "Établissements adaptés à votre profil et votre domaine." },
  { icon: "📝", title: "Dossier de candidature", text: "Lettre de motivation académique générée par IA." },
  { icon: "🏛️", title: "Campus France", text: "Guide personnalisé + simulation d'entretien." },
  { icon: "💰", title: "Bourses", text: "Toutes les bourses auxquelles vous pouvez prétendre." },
  { icon: "🏠", title: "Logement", text: "Trouver et sécuriser votre logement étudiant." },
  { icon: "✈️", title: "Visa étudiant", text: "Checklist personnalisée jusqu'au dépôt." },
];

const PLANS = [
  { name: "Diagnostic", price: "Gratuit", items: ["Score 0-100", "Plan personnalisé"], featured: false },
  { name: "Pack Candidature", price: "19 500 FCFA", items: ["Lettres IA", "Guide Campus France"], featured: true },
  { name: "Pack Complet", price: "45 000 FCFA", items: ["Tout le Pack Candidature", "Simulation entretien", "Checklist visa"], featured: false },
  { name: "VIP", price: "99 000 FCFA", items: ["Tout le Pack Complet", "Accompagnement humain", "Suivi 3 mois"], featured: false },
];

const TESTIMONIALS = [
  { name: "Mamadou S.", parcours: "Sénégal 🇸🇳 → Master Informatique, Paris", color: "#1A52C8" },
  { name: "Aya K.", parcours: "Côte d'Ivoire 🇨🇮 → Licence Commerce, Lyon", color: "#D4961A" },
  { name: "Yannick T.", parcours: "Cameroun 🇨🇲 → Master Médecine, Montréal", color: "#0A0F2C" },
];

export default function Etudiant() {
  const navigate = useNavigate();
  // Redirige vers le parcours universel (les CTA étudiant pointent ici).
  const start = () => navigate("/nouveau-dossier");

  return (
    <div style={{ width: "100%", overflowX: "hidden" }}>
      {/* HERO */}
      <section style={{ background: `linear-gradient(135deg, ${C.blue}, ${C.blueMid})` }}>
        <div className="mx-auto max-w-5xl px-4 py-16 text-center md:py-24">
          <span
            className="inline-block rounded-full px-4 py-1 text-sm font-semibold"
            style={{ backgroundColor: "rgba(255,255,255,0.14)", color: "white" }}
          >
            🎓 VisaCoach Étudiant
          </span>
          <h1 className="mt-5 text-4xl font-bold text-white sm:text-5xl" style={serif}>
            De votre pays à votre diplôme — l'accompagnement complet
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-white/85">
            VisaCoach Étudiant guide chaque étape : choix d'université, Campus
            France, bourses, logement et visa.
          </p>
          <button
            type="button"
            onClick={start}
            className="mt-8 rounded-xl px-7 py-4 text-base font-bold shadow-lg transition hover:brightness-95"
            style={{ backgroundColor: C.gold, color: C.ink }}
          >
            Commencer mon diagnostic étudiant →
          </button>
          <div className="mt-6 flex flex-wrap justify-center gap-3 text-white/90">
            <span>🇫🇷 France</span>
            <span>🇨🇦 Canada</span>
            <span>🇺🇸 USA</span>
            <span>🇧🇪 Belgique</span>
          </div>
        </div>
      </section>

      {/* MODULES */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            6 modules, du choix de l'université au visa
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {MODULES.map((m) => (
              <div key={m.title} className="rounded-2xl p-6" style={{ backgroundColor: C.mist, border: `1px solid ${C.border}` }}>
                <div className="text-3xl">{m.icon}</div>
                <h3 className="mt-3 font-bold" style={{ color: C.ink }}>{m.title}</h3>
                <p className="mt-2 text-sm" style={{ color: C.slate }}>{m.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ backgroundColor: C.mist }}>
        <div className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Des formules pour chaque besoin
          </h2>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((p) => (
              <div
                key={p.name}
                className="flex flex-col rounded-2xl bg-white p-6"
                style={{ border: p.featured ? `2px solid ${C.gold}` : `1px solid ${C.border}` }}
              >
                <h3 className="font-bold" style={{ color: C.ink }}>{p.name}</h3>
                <p className="mt-2 text-2xl font-extrabold" style={{ color: C.blue }}>{p.price}</p>
                <ul className="mt-4 flex-1 space-y-1 text-sm" style={{ color: C.slate }}>
                  {p.items.map((it) => (
                    <li key={it} className="flex gap-2"><span style={{ color: C.blue }}>✓</span>{it}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={start}
                  className="mt-6 rounded-xl py-2.5 text-sm font-bold"
                  style={p.featured ? { backgroundColor: C.gold, color: C.ink } : { backgroundColor: C.blue, color: "white" }}
                >
                  Choisir
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* TÉMOIGNAGES */}
      <section className="bg-white">
        <div className="mx-auto max-w-5xl px-4 py-16">
          <h2 className="text-center text-3xl font-bold" style={{ ...serif, color: C.ink }}>
            Ils étudient déjà à l'étranger
          </h2>
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl p-6" style={{ backgroundColor: C.mist }}>
                <div className="flex items-center gap-3">
                  <span
                    className="flex h-10 w-10 items-center justify-center rounded-full font-bold text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <div className="font-bold" style={{ color: C.ink }}>{t.name}</div>
                    <div className="text-xs" style={{ color: C.slate }}>{t.parcours}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-12 text-center">
            <button
              type="button"
              onClick={start}
              className="rounded-xl px-7 py-4 text-base font-bold text-white"
              style={{ backgroundColor: C.blue }}
            >
              Commencer mon diagnostic étudiant →
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
