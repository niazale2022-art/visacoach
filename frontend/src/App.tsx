import { useEffect, useState, type CSSProperties } from "react";
import { Link, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import Home from "./pages/Home";
import Diagnostic from "./pages/Diagnostic";
import Score from "./pages/Score";
import Rapport from "./pages/Rapport";
import Dossier from "./pages/Dossier";
import Conseils from "./pages/Conseils";
import Success from "./pages/Success";
import Offline from "./pages/Offline";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import ResetPassword from "./pages/ResetPassword";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { useAuth } from "./contexts/AuthContext";

/** Événement `beforeinstallprompt` (non standardisé dans lib.dom). */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

// Styles partagés de la navbar.
const navLink: CSSProperties = {
  color: "rgba(255,255,255,0.8)",
  textDecoration: "none",
  fontSize: "0.875rem",
  fontWeight: 500,
};
const goldNavBtn: CSSProperties = {
  background: "#F7B731",
  color: "#0A0F2C",
  border: "none",
  padding: "9px 22px",
  borderRadius: "6px",
  fontWeight: 700,
  cursor: "pointer",
  fontSize: "0.875rem",
};
const mobileLink: CSSProperties = {
  color: "white",
  textDecoration: "none",
  fontWeight: 600,
  fontSize: "1rem",
  padding: "8px 0",
  borderBottom: "1px solid rgba(255,255,255,0.1)",
};
const mobileGoldBtn: CSSProperties = {
  background: "#F7B731",
  color: "#0A0F2C",
  border: "none",
  padding: "14px",
  borderRadius: "8px",
  fontWeight: 800,
  cursor: "pointer",
  fontSize: "1rem",
};

/**
 * Layout principal + routage de l'application.
 *
 * Tunnel : Home -> Diagnostic -> Score -> (paiement) -> Success -> Rapport
 */
export default function App() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  // La Home s'affiche pleine largeur ; les autres pages restent dans un
  // conteneur centré avec padding.
  const isHome = location.pathname === "/";

  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e as BeforeInstallPromptEvent);
      setShowInstallBanner(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    const { outcome } = await installPrompt.userChoice;
    if (outcome === "accepted") setShowInstallBanner(false);
    setInstallPrompt(null);
  };

  return (
    <div className="flex min-h-full flex-col">
      <header style={{ backgroundColor: "#1434A4" }}>
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="flex items-center gap-2">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-lg text-lg"
              style={{ backgroundColor: "rgba(255,255,255,0.12)", color: "#F7B731" }}
            >
              ✈
            </span>
            <span className="text-lg font-extrabold tracking-tight text-white">
              Visa<span style={{ color: "#F7B731" }}>Coach</span>
            </span>
          </Link>

          {/* Liens desktop (cachés < 768px via .nav-desktop) */}
          <ul
            className="nav-desktop"
            style={{
              display: "flex",
              gap: "28px",
              listStyle: "none",
              alignItems: "center",
              margin: 0,
              padding: 0,
            }}
          >
            <li>
              <a href="/#process" style={navLink}>
                Comment ça marche
              </a>
            </li>
            <li>
              <a href="/#pricing" style={navLink}>
                Tarifs
              </a>
            </li>
            <li>
              <a href="/#faq" style={navLink}>
                FAQ
              </a>
            </li>
            {user ? (
              <li>
                <button type="button" onClick={() => navigate("/dashboard")} style={goldNavBtn}>
                  Mon dossier →
                </button>
              </li>
            ) : (
              <>
                <li>
                  <a href="/login" style={navLink}>
                    Se connecter
                  </a>
                </li>
                <li>
                  <button type="button" onClick={() => navigate("/diagnostic")} style={goldNavBtn}>
                    Diagnostic gratuit →
                  </button>
                </li>
              </>
            )}
          </ul>

          {/* Bouton hamburger (visible < 768px via .nav-hamburger) */}
          <button
            type="button"
            className="nav-hamburger"
            onClick={() => setMenuOpen((o) => !o)}
            aria-label="Menu"
            style={{
              display: "none",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px",
              color: "white",
              fontSize: "1.5rem",
            }}
          >
            {menuOpen ? "✕" : "☰"}
          </button>
        </div>
      </header>

      {/* Menu mobile déroulant */}
      {menuOpen && (
        <div
          style={{
            position: "fixed",
            top: "64px",
            left: 0,
            right: 0,
            background: "#1434A4",
            zIndex: 99,
            padding: "20px 5%",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          }}
        >
          <a href="/#process" onClick={() => setMenuOpen(false)} style={mobileLink}>
            Comment ça marche
          </a>
          <a href="/#pricing" onClick={() => setMenuOpen(false)} style={mobileLink}>
            Tarifs
          </a>
          <a href="/#faq" onClick={() => setMenuOpen(false)} style={mobileLink}>
            FAQ
          </a>
          {user ? (
            <button
              type="button"
              onClick={() => {
                navigate("/dashboard");
                setMenuOpen(false);
              }}
              style={mobileGoldBtn}
            >
              Mon dossier →
            </button>
          ) : (
            <>
              <a
                href="/login"
                onClick={() => setMenuOpen(false)}
                style={{ ...mobileLink, borderBottom: "none" }}
              >
                Se connecter
              </a>
              <button
                type="button"
                onClick={() => {
                  navigate("/diagnostic");
                  setMenuOpen(false);
                }}
                style={mobileGoldBtn}
              >
                Diagnostic gratuit →
              </button>
            </>
          )}
        </div>
      )}

      {/* Bannière d'installation PWA */}
      {showInstallBanner && (
        <div
          style={{
            background: "#1434A4",
            color: "white",
            padding: "12px 5%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "16px",
            flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            📱 Installez VisaCoach sur votre téléphone pour un accès rapide
          </span>
          <div style={{ display: "flex", gap: "10px" }}>
            <button
              type="button"
              onClick={handleInstall}
              style={{
                background: "#F7B731",
                color: "#0A0F2C",
                border: "none",
                padding: "8px 18px",
                borderRadius: "6px",
                fontWeight: 700,
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              Installer
            </button>
            <button
              type="button"
              onClick={() => setShowInstallBanner(false)}
              style={{
                background: "transparent",
                color: "rgba(255,255,255,0.7)",
                border: "1px solid rgba(255,255,255,0.3)",
                padding: "8px 14px",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.82rem",
              }}
            >
              Plus tard
            </button>
          </div>
        </div>
      )}

      <main
        className={
          isHome
            ? "w-full flex-1"
            : "mx-auto w-full max-w-5xl flex-1 px-4 py-8"
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/diagnostic" element={<Diagnostic />} />
          <Route path="/score/:id" element={<Score />} />
          <Route path="/rapport/:id" element={<Rapport />} />
          <Route path="/dossier/:diagnostic_id" element={<Dossier />} />
          <Route path="/conseils/:diagnostic_id" element={<Conseils />} />
          <Route path="/success" element={<Success />} />
          <Route path="/offline" element={<Offline />} />
        </Routes>
      </main>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-6 text-center text-sm text-slate-400">
          © {new Date().getFullYear()} VisaCoach — Accompagnement méthodologique.
          Ne garantit pas l'obtention du visa.
        </div>
      </footer>

      {/* Bouton WhatsApp flottant (global) */}
      <a
        href="https://wa.me/33767787541?text=Bonjour%2C%20j%27ai%20une%20question%20sur%20VisaCoach"
        target="_blank"
        rel="noopener noreferrer"
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 1000,
          background: "#25D366",
          color: "white",
          borderRadius: "50px",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontWeight: 700,
          fontSize: "0.875rem",
          textDecoration: "none",
          boxShadow: "0 4px 20px rgba(37,211,102,0.4)",
        }}
      >
        💬 Une question ?
      </a>
    </div>
  );
}
