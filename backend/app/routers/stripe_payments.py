"""Paiements Stripe (EUR) pour les dossiers universels.

Endpoints :
  POST /api/stripe/checkout        -> crée une session Stripe Checkout
  POST /api/stripe/webhook         -> notifications Stripe (paiement confirmé)
  GET  /api/stripe/verify/{id}     -> vérifie le statut d'un paiement

Le webhook est la source de vérité : il bascule le dossier en « payé ».
La source de vérité du statut reste la table `dossiers_universels`
(`statut_paiement`) ; l'écriture dans `orders` est best-effort (try/except)
car son schéma historique peut différer.
"""

from __future__ import annotations

import stripe
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from app.core.config import settings
from app.core.supabase import get_supabase

router = APIRouter()

stripe.api_key = settings.STRIPE_SECRET_KEY

# Tarifs Stripe en centimes d'euro.
STRIPE_PRICES = {
    "rapport": {"amount": 9900, "currency": "eur", "label": "Rapport Martin — VisaCoach"},
    "dossier": {"amount": 19900, "currency": "eur", "label": "Pack Dossier — VisaCoach"},
    "vip": {"amount": 79900, "currency": "eur", "label": "VIP + Humain — VisaCoach"},
}


class StripeCheckoutRequest(BaseModel):
    plan: str  # rapport | dossier | vip
    dossier_id: str
    user_email: str
    user_id: str | None = None


@router.post("/checkout")
def create_checkout_session(body: StripeCheckoutRequest) -> dict:
    """Crée une session de paiement Stripe Checkout pour un dossier."""
    price = STRIPE_PRICES.get(body.plan)
    if not price:
        raise HTTPException(status_code=400, detail=f"Plan invalide : {body.plan}")

    try:
        session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[
                {
                    "price_data": {
                        "currency": price["currency"],
                        "product_data": {
                            "name": price["label"],
                            "description": "Dossier visa VisaCoach — accompagnement personnalisé par Martin.",
                        },
                        "unit_amount": price["amount"],
                    },
                    "quantity": 1,
                }
            ],
            mode="payment",
            success_url=(
                f"{settings.FRONTEND_URL}/paiement/succes"
                f"?session_id={{CHECKOUT_SESSION_ID}}&dossier_id={body.dossier_id}"
            ),
            cancel_url=f"{settings.FRONTEND_URL}/dossier-universel/{body.dossier_id}",
            customer_email=body.user_email or None,
            metadata={
                "dossier_id": body.dossier_id,
                "plan": body.plan,
                "user_id": body.user_id or "",
            },
        )
    except stripe.error.StripeError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    # Trace best-effort dans `orders` ; ne bloque jamais le paiement.
    try:
        get_supabase().table("orders").insert(
            {
                "transaction_id": session.id,
                "plan": body.plan,
                "amount_eur": price["amount"] / 100,
                "currency": "EUR",
                "customer_email": body.user_email,
                "status": "PENDING",
                "payment_provider": "stripe",
                "dossier_id": body.dossier_id,
            }
        ).execute()
    except Exception:  # noqa: BLE001 — schéma orders historique : on ignore
        pass

    # Marque le dossier en attente de paiement (défensif).
    try:
        get_supabase().table("dossiers_universels").update(
            {"statut_paiement": "en_attente", "plan": body.plan, "updated_at": "now()"}
        ).eq("id", body.dossier_id).execute()
    except Exception:  # noqa: BLE001
        pass

    return {"checkout_url": session.url, "session_id": session.id}


@router.post("/webhook")
async def stripe_webhook(request: Request) -> dict:
    """Reçoit les notifications Stripe et active le dossier après paiement."""
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature")

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except Exception as exc:  # noqa: BLE001 — signature invalide / payload corrompu
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        metadata = session.get("metadata") or {}
        dossier_id = metadata.get("dossier_id")
        plan = metadata.get("plan")

        if dossier_id:
            try:
                get_supabase().table("dossiers_universels").update(
                    {
                        "statut_paiement": "paye",
                        "plan": plan,
                        "montant_paye": session.get("amount_total", 0),
                        "updated_at": "now()",
                    }
                ).eq("id", dossier_id).execute()
            except Exception:  # noqa: BLE001
                pass

            try:
                get_supabase().table("orders").update(
                    {"status": "PAID", "paid_at": "now()"}
                ).eq("transaction_id", session["id"]).execute()
            except Exception:  # noqa: BLE001
                pass

    return {"status": "ok"}


@router.get("/verify/{session_id}")
def verify_payment(session_id: str) -> dict:
    """Vérifie le statut d'un paiement Stripe (appelé par la page de succès)."""
    try:
        session = stripe.checkout.Session.retrieve(session_id)
    except stripe.error.StripeError as exc:  # type: ignore[attr-defined]
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    metadata = session.get("metadata") or {}
    return {
        "status": session.get("payment_status"),
        "paid": session.get("payment_status") == "paid",
        "dossier_id": metadata.get("dossier_id"),
        "plan": metadata.get("plan"),
    }
