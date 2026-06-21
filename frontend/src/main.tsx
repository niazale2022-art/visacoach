import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./contexts/AuthContext";
import ErrorBoundary from "./components/ErrorBoundary";
import "./index.css";

// Quand un nouveau service worker prend le contrôle (après un déploiement),
// on recharge la page une fois pour servir le bundle à jour — évite qu'un
// ancien bundle en cache masque les nouvelles versions en production.
if ("serviceWorker" in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  // `autoUpdate` ne vérifie une nouvelle version qu'au chargement de la page :
  // un onglet (ou la PWA installée) laissé ouvert reste bloqué sur l'ancien
  // bundle. On force une vérification périodique pour que tout déploiement se
  // propage en ~1 min sans rechargement manuel.
  navigator.serviceWorker.ready
    .then((registration) => {
      setInterval(() => registration.update(), 60 * 1000);
    })
    .catch(() => {
      /* pas de SW disponible — sans effet */
    });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <ErrorBoundary>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ErrorBoundary>
    </BrowserRouter>
  </React.StrictMode>,
);
