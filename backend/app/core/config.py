"""Chargement et validation des variables d'environnement.

Toutes les clés secrètes (Supabase, CinetPay, Stripe, Claude, Resend) sont lues
ici via pydantic-settings. Voir `.env.example` à la racine du projet pour la
liste complète et les valeurs attendues.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Variables d'environnement de l'application VisaCoach."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Général --------------------------------------------------------
    APP_NAME: str = "VisaCoach API"
    ENVIRONMENT: str = "development"  # development | production
    # URL publique du backend (Railway) — utile pour les callbacks/webhooks.
    BACKEND_URL: str = "http://localhost:8000"
    # Origines autorisées pour le CORS (séparées par des virgules)
    FRONTEND_URL: str = "http://localhost:5173"
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://localhost:3000"

    # --- Supabase -------------------------------------------------------
    SUPABASE_URL: str = ""
    # Clé service_role (backend uniquement — ne JAMAIS exposer côté frontend)
    SUPABASE_SERVICE_KEY: str = ""

    # --- Claude (Anthropic) ---------------------------------------------
    ANTHROPIC_API_KEY: str = ""
    CLAUDE_MODEL: str = "claude-sonnet-4-6"

    # --- CinetPay (FCFA / mobile money Afrique) -------------------------
    CINETPAY_API_KEY: str = ""
    CINETPAY_SITE_ID: str = ""
    # URL de base de l'API CinetPay v2
    CINETPAY_BASE_URL: str = "https://api-checkout.cinetpay.com/v2"
    # URL appelée par CinetPay (serveur → serveur) après paiement
    CINETPAY_NOTIFY_URL: str = "http://localhost:8000/api/payments/cinetpay/notify"
    # URL de redirection de l'utilisateur après paiement
    CINETPAY_RETURN_URL: str = "http://localhost:5173/success"

    # --- Stripe (EUR / diaspora) ----------------------------------------
    STRIPE_SECRET_KEY: str = ""
    STRIPE_WEBHOOK_SECRET: str = ""
    STRIPE_SUCCESS_URL: str = "http://localhost:5173/success?session_id={CHECKOUT_SESSION_ID}"
    STRIPE_CANCEL_URL: str = "http://localhost:5173/rapport"

    # --- Resend (emails transactionnels) --------------------------------
    RESEND_API_KEY: str = ""
    RESEND_FROM_EMAIL: str = "VisaCoach <contact@visacoach.app>"

    # --- Tarifs (en centimes pour Stripe, en FCFA pour CinetPay) --------
    # rapport = Rapport Martin ; suivi = Pack Dossier
    PRICE_RAPPORT_FCFA: int = 65000
    PRICE_RAPPORT_EUR_CENTS: int = 9900  # 99 €
    PRICE_SUIVI_FCFA: int = 130000
    PRICE_SUIVI_EUR_CENTS: int = 19900  # 199 €

    @property
    def origins(self) -> list[str]:
        """Liste des origines CORS, nettoyée."""
        return [o.strip() for o in self.ALLOWED_ORIGINS.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    """Retourne l'instance unique des settings (mise en cache)."""
    return Settings()


settings = get_settings()
