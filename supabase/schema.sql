-- =====================================================================
-- VisaCoach — Schéma Supabase (PostgreSQL)
-- =====================================================================
-- À exécuter dans l'éditeur SQL de Supabase (SQL Editor).
-- Tables : diagnostics -> orders -> reports
-- =====================================================================

-- Extension pour générer des UUID (présente par défaut sur Supabase).
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Table : diagnostics
-- Résultat du diagnostic gratuit (7 questions -> score 0-100).
-- ---------------------------------------------------------------------
create table if not exists public.diagnostics (
    id          uuid primary key default gen_random_uuid(),
    email       text not null,
    full_name   text,
    country     text,
    answers     jsonb not null default '[]'::jsonb,
    score       integer not null check (score >= 0 and score <= 100),
    level       text not null check (level in ('faible', 'moyen', 'bon', 'excellent')),
    created_at  timestamptz not null default now()
);

create index if not exists diagnostics_email_idx on public.diagnostics (email);
create index if not exists diagnostics_created_at_idx on public.diagnostics (created_at desc);

-- ---------------------------------------------------------------------
-- Table : orders
-- Une commande de paiement (CinetPay en FCFA ou Stripe en EUR).
-- ---------------------------------------------------------------------
create table if not exists public.orders (
    id              uuid primary key default gen_random_uuid(),
    diagnostic_id   uuid not null references public.diagnostics (id) on delete cascade,
    email           text not null,
    plan            text not null check (plan in ('rapport', 'suivi')),
    provider        text not null check (provider in ('cinetpay', 'stripe')),
    amount          integer not null,            -- FCFA pour CinetPay, centimes pour Stripe
    currency        text not null,               -- 'XOF' ou 'EUR'
    transaction_id  text not null unique,
    status          text not null default 'pending'
                        check (status in ('pending', 'paid', 'failed', 'refunded')),
    created_at      timestamptz not null default now()
);

create index if not exists orders_diagnostic_id_idx on public.orders (diagnostic_id);
create index if not exists orders_transaction_id_idx on public.orders (transaction_id);
create index if not exists orders_status_idx on public.orders (status);

-- ---------------------------------------------------------------------
-- Table : reports
-- Rapport personnalisé généré par Claude une fois le paiement validé.
-- ---------------------------------------------------------------------
create table if not exists public.reports (
    id              uuid primary key default gen_random_uuid(),
    diagnostic_id   uuid not null references public.diagnostics (id) on delete cascade,
    order_id        uuid references public.orders (id) on delete set null,
    plan            text not null check (plan in ('rapport', 'suivi')),
    content         text not null,               -- Markdown
    email_sent      boolean not null default false,
    created_at      timestamptz not null default now()
);

create unique index if not exists reports_diagnostic_id_uidx on public.reports (diagnostic_id);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
-- Le backend utilise la clé `service_role` qui contourne la RLS. On active
-- quand même la RLS pour bloquer tout accès direct via la clé `anon` publique.
alter table public.diagnostics enable row level security;
alter table public.orders      enable row level security;
alter table public.reports     enable row level security;

-- Aucune policy `anon`/`authenticated` n'est créée : par défaut, RLS activée
-- sans policy = accès refusé pour ces rôles. Seul le backend (service_role)
-- peut lire/écrire. Ajoutez des policies si vous exposez l'accès direct au front.


-- =====================================================================
-- Module « Dossier » : constitution et vérification IA des documents
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table : dossier_documents
-- Un document uploadé par le candidat + le résultat de l'analyse IA.
-- ---------------------------------------------------------------------
create table if not exists public.dossier_documents (
    id              uuid primary key default gen_random_uuid(),
    diagnostic_id   uuid not null references public.diagnostics (id) on delete cascade,
    type            text not null,               -- PASSEPORT, RELEVE_BANCAIRE, etc.
    filename        text not null,
    storage_path    text not null,               -- chemin dans Supabase Storage
    status          text not null default 'EN_ATTENTE'
                        check (status in ('EN_ATTENTE', 'VALIDE', 'ATTENTION', 'PROBLEME')),
    feedback        text,
    suggestions     jsonb,
    note            integer check (note is null or (note >= 0 and note <= 100)),
    created_at      timestamptz not null default now(),
    updated_at      timestamptz not null default now()
);

create index if not exists dossier_documents_diagnostic_id_idx
    on public.dossier_documents (diagnostic_id);
create index if not exists dossier_documents_type_idx
    on public.dossier_documents (diagnostic_id, type);

-- ---------------------------------------------------------------------
-- Table : dossier_progress
-- Score de progression global du dossier (un par diagnostic).
-- ---------------------------------------------------------------------
create table if not exists public.dossier_progress (
    id                  uuid primary key default gen_random_uuid(),
    diagnostic_id       uuid not null unique references public.diagnostics (id) on delete cascade,
    score_global        integer not null default 0 check (score_global >= 0 and score_global <= 100),
    documents_requis    jsonb not null default '[]'::jsonb,  -- types requis selon le profil
    documents_valides   integer not null default 0,
    documents_total     integer not null default 0,
    updated_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- RLS (mêmes règles : seul le service_role accède)
-- ---------------------------------------------------------------------
alter table public.dossier_documents enable row level security;
alter table public.dossier_progress  enable row level security;

-- ---------------------------------------------------------------------
-- Supabase Storage : bucket privé pour les documents du dossier
-- ---------------------------------------------------------------------
-- Bucket privé : seul le backend (service_role) lit/écrit les fichiers.
insert into storage.buckets (id, name, public)
values ('dossier-documents', 'dossier-documents', false)
on conflict (id) do nothing;


-- =====================================================================
-- Authentification : rattachement des diagnostics aux comptes utilisateurs
-- =====================================================================
-- Colonne user_id reliée à auth.users (NULL pour les diagnostics anonymes).
alter table public.diagnostics
    add column if not exists user_id uuid references auth.users (id) on delete set null;

create index if not exists idx_diagnostics_user_id on public.diagnostics (user_id);

-- RLS : un utilisateur connecté ne lit que ses propres diagnostics.
-- (La RLS est déjà activée plus haut ; on (re)crée la policy de lecture.)
drop policy if exists "users_own_diagnostics" on public.diagnostics;
create policy "users_own_diagnostics"
    on public.diagnostics for select
    using (user_id = auth.uid() or user_id is null);

-- NOTE confidentialité : la clause « or user_id is null » laisse tout utilisateur
-- connecté lire les diagnostics anonymes. Pour un cloisonnement strict en prod,
-- retirez « or user_id is null » (les diagnostics anonymes ne seront alors lisibles
-- que par le backend via la clé service_role).


-- =====================================================================
-- Module « Visa Étudiant » : parcours dédié (université, Campus France,
-- bourses, logement, visa).
-- =====================================================================
create table if not exists public.etudiant_diagnostics (
    id                      uuid primary key default gen_random_uuid(),
    user_id                 uuid references auth.users (id) on delete set null,
    pays_destination        text not null,
    niveau_etudes           text not null,
    domaine                 text not null,
    niveau_francais         text not null,
    test_langue             text,
    etablissement_confirme  boolean not null default false,
    campus_france_status    text,
    budget_mensuel          text,
    garant                  boolean not null default false,
    situation_academique    text,
    score                   integer check (score is null or (score >= 0 and score <= 100)),
    modules_status          jsonb not null default '{}'::jsonb,
    created_at              timestamptz not null default now()
);

create index if not exists idx_etudiant_diagnostics_user_id
    on public.etudiant_diagnostics (user_id);

alter table public.etudiant_diagnostics enable row level security;

-- RLS : un utilisateur connecté ne lit que ses propres diagnostics étudiants.
drop policy if exists "users_own_etudiant_diagnostics" on public.etudiant_diagnostics;
create policy "users_own_etudiant_diagnostics"
    on public.etudiant_diagnostics for select
    using (user_id = auth.uid() or user_id is null);


-- =====================================================================
-- Parcours universel : un seul tunnel pour tous les types de visa.
-- =====================================================================

-- Dossier universel principal.
create table if not exists public.dossiers_universels (
    id                   uuid primary key default gen_random_uuid(),
    user_id              uuid references auth.users (id) on delete cascade,
    type_visa            text not null,        -- tourisme, etudiant, famille, affaires, medical, conjoint, transit
    pays_destination     text not null,
    pays_origine         text not null,
    statut               text not null default 'en_cours'
                            check (statut in ('en_cours', 'pret', 'depose', 'obtenu', 'refuse')),
    score_global         integer not null default 0 check (score_global between 0 and 100),
    score_coherence      integer,
    profil_demandeur     jsonb,  -- âge, situation familiale, propriétaire, historique voyage, emploi
    profil_risque        jsonb,
    date_depot_optimale  date,
    created_at           timestamptz not null default now(),
    updated_at           timestamptz not null default now()
);

create index if not exists idx_dossiers_universels_user_id
    on public.dossiers_universels (user_id);

-- Pour les bases existantes (table déjà créée sans la colonne).
alter table public.dossiers_universels
    add column if not exists profil_demandeur jsonb;

-- Pièces (documents) du dossier universel.
create table if not exists public.dossier_pieces (
    id                uuid primary key default gen_random_uuid(),
    dossier_id        uuid not null references public.dossiers_universels (id) on delete cascade,
    type_document     text not null,
    label             text not null,
    obligatoire       boolean not null default true,
    statut            text not null default 'a_fournir'
                          check (statut in ('a_fournir', 'uploade', 'valide', 'incomplet', 'probleme')),
    storage_path      text,
    feedback_ia       text,
    suggestions       jsonb,
    note              integer check (note is null or (note between 0 and 100)),
    donnees_extraites jsonb,
    created_at        timestamptz not null default now(),
    updated_at        timestamptz not null default now()
);

create index if not exists idx_dossier_pieces_dossier_id
    on public.dossier_pieces (dossier_id);
create index if not exists idx_dossier_pieces_type
    on public.dossier_pieces (dossier_id, type_document);

-- Analyses de cohérence inter-documents.
create table if not exists public.analyses_coherence (
    id                     uuid primary key default gen_random_uuid(),
    dossier_id             uuid not null references public.dossiers_universels (id) on delete cascade,
    score_coherence        integer,
    niveau                 text,
    incoherences_critiques jsonb,
    points_vigilance       jsonb,
    points_forts           jsonb,
    recommandations        jsonb,
    created_at             timestamptz not null default now()
);

create index if not exists idx_analyses_coherence_dossier_id
    on public.analyses_coherence (dossier_id);

-- Colonnes supplémentaires (verdict consulaire) — pour bases existantes aussi.
alter table public.analyses_coherence
    add column if not exists verdict_consul text;
alter table public.analyses_coherence
    add column if not exists probabilite_accord integer;
alter table public.analyses_coherence
    add column if not exists resume_consul text;

-- RLS (lecture limitée au propriétaire ; le backend service_role contourne).
alter table public.dossiers_universels enable row level security;
alter table public.dossier_pieces      enable row level security;
alter table public.analyses_coherence  enable row level security;

drop policy if exists "users_own_dossiers" on public.dossiers_universels;
create policy "users_own_dossiers"
    on public.dossiers_universels for select
    using (user_id = auth.uid() or user_id is null);

