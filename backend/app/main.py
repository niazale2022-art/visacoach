from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.routers import (
    diagnostics,
    dossier,
    dossier_universel,
    etudiant,
    generation,
    martin,
    payments,
    reports,
    stripe_payments,
)

app = FastAPI(
    title=settings.APP_NAME,
    description="API du coach IA pour l'obtention de visa — Afrique francophone.",
    version="0.1.0",
)

# Origines CORS selon l'environnement (production vs développement).
if settings.ENVIRONMENT == "production":
    origins = ["https://visacoach.fr", "https://www.visacoach.fr"]
    # Autorise aussi l'URL frontend configurée (ex. domaine Vercel) si fournie.
    if settings.FRONTEND_URL.startswith("https://") and settings.FRONTEND_URL not in origins:
        origins.append(settings.FRONTEND_URL)
else:
    origins = [
        "http://localhost:5173",
        "http://localhost:5174",
        "http://localhost:5175",
        "http://localhost:4173",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(diagnostics.router, prefix="/api/diagnostics", tags=["diagnostics"])
app.include_router(payments.router, prefix="/api/payments", tags=["payments"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(dossier.router, prefix="/api/dossier", tags=["dossier"])
app.include_router(generation.router, prefix="/api/generation", tags=["generation"])
app.include_router(etudiant.router, prefix="/api/etudiant", tags=["etudiant"])
app.include_router(
    dossier_universel.router,
    prefix="/api/dossier-universel",
    tags=["dossier-universel"],
)
app.include_router(martin.router, prefix="/api/martin", tags=["martin"])
app.include_router(stripe_payments.router, prefix="/api/stripe", tags=["stripe"])


@app.get("/", tags=["meta"])
def root() -> dict:
    return {"app": settings.APP_NAME, "version": "0.1.0", "status": "ok"}


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "healthy", "environment": settings.ENVIRONMENT}