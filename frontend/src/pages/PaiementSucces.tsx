import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import MartinAvatar from "../components/MartinAvatar";

const C = {
  blue: "#1434A4",
  ink: "#0A0F2C",
  slate: "#4A5580",
  white: "#FFFFFF",
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

type State = "checking" | "paid" | "unpaid" | "error";

/** Page de retour après un paiement Stripe (carte / euros). */
export default function PaiementSucces() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const dossierIdParam = params.get("dossier_id");

  const [state, setState] = useState<State>("checking");
  const [dossierId, setDossierId] = useState<string | null>(dossierIdParam);

  useEffect(() => {
    if (!sessionId) {
      setState("error");
      return;
    }
    fetch(`${API_URL}/api/stripe/verify/${sessionId}`)
      .then((r) => {
        if (!r.ok) throw new Error("verify failed");
        return r.json();
      })
      .then((data) => {
        if (data.dossier_id) setDossierId(data.dossier_id);
        setState(data.paid ? "paid" : "unpaid");
      })
      .catch(() => setState("error"));
  }, [sessionId]);

  return (
    <div style={{ textAlign: "center", padding: "72px 5%", maxWidth: "560px", margin: "0 auto" }}>
      {state === "checking" && (
        <>
          <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>⏳</div>
          <p style={{ color: C.slate }}>Vérification de votre paiement…</p>
        </>
      )}

      {state === "paid" && (
        <>
          <div style={{ fontSize: "4rem", marginBottom: "16px" }}>🎉</div>
          <h1 style={{ fontFamily: "serif", fontSize: "1.8rem", color: C.ink, marginBottom: "8px" }}>
            Paiement confirmé !
          </h1>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "10px",
              background: "#EBF0FF",
              borderRadius: "12px",
              padding: "12px 18px",
              margin: "16px 0",
              textAlign: "left",
            }}
          >
            <MartinAvatar size="sm" withStatus />
            <span style={{ fontSize: "0.9rem", color: C.slate }}>
              Je vais maintenant vous accompagner dans la constitution de votre dossier. — Martin
            </span>
          </div>
          <div>
            <button
              type="button"
              onClick={() => navigate(dossierId ? `/dossier-universel/${dossierId}` : "/mes-dossiers")}
              style={{
                background: C.blue,
                color: C.white,
                border: "none",
                padding: "14px 28px",
                borderRadius: "10px",
                fontWeight: 800,
                fontSize: "1rem",
                cursor: "pointer",
              }}
            >
              Accéder à mon dossier →
            </button>
          </div>
        </>
      )}

      {(state === "unpaid" || state === "error") && (
        <>
          <div style={{ fontSize: "3rem", marginBottom: "16px" }}>⚠️</div>
          <h1 style={{ fontFamily: "serif", fontSize: "1.5rem", color: C.ink, marginBottom: "8px" }}>
            Paiement non confirmé
          </h1>
          <p style={{ color: C.slate, marginBottom: "20px" }}>
            {state === "unpaid"
              ? "Votre paiement n'a pas encore été validé. Si vous venez de payer, patientez quelques instants puis rechargez la page."
              : "Nous n'avons pas pu vérifier votre paiement. Réessayez ou contactez-nous."}
          </p>
          <button
            type="button"
            onClick={() => navigate(dossierId ? `/dossier-universel/${dossierId}` : "/mes-dossiers")}
            style={{
              background: C.blue,
              color: C.white,
              border: "none",
              padding: "12px 24px",
              borderRadius: "10px",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Retour à mon dossier
          </button>
        </>
      )}
    </div>
  );
}
