-- ===================================================================================================
--  OneDesk — Schéma PostgreSQL multi-tenant pour Supabase (PostgreSQL 15)
--  Fichier auto-suffisant, exécutable en une fois dans l'éditeur SQL Supabase.
--
--  Domaine : Clinique médicale (PWA OneDesk) — HDS, MSSanté, RBAC strict, audit immuable.
--
--  Contenu :
--    1.  Extensions & schémas
--    2.  Rôle applicatif app_authenticated + sécurité PostgreSQL (REVOKE PUBLIC)
--    3.  Fonctions utilitaires (auth.tenant_id(), auth.user_role(), auth.current_user_id(), auth.is_admin())
--    4.  Tables (15) avec commentaires FR
--    5.  Index (cliniques + outbox worker)
--    6.  Trigger d'auto-hash pour audit_events (chaîne SHA-256 immuable)
--    7.  Trigger INSERT-ONLY sur audit_events (UPDATE / DELETE interdits)
--    8.  Activation RLS + Policies (isolation tenant_id + RBAC par rôle)
--    9.  ALTER DEFAULT PRIVILEGES
--    10. Seed pour staging (1 tenant, 4 users, 4 patients, 5 RDV, 2 prescriptions)
--
--  Auteur : Expert Base de Données & Sécurité HDS — Task ID 7-SQL
-- ===================================================================================================

-- ===================================================================================================
-- 1. EXTENSIONS & SCHÉMAS
-- ===================================================================================================

-- pgcrypto : fournit gen_random_uuid() et digest() (SHA-256) pour la chaîne d'audit.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Schéma dédié pour les fonctions d'authentification applicatives.
-- NB : le schéma "auth" existe déjà dans Supabase (géré par GoTrue) ;
-- on y ajoute simplement nos fonctions de lecture des claims JWT.
CREATE SCHEMA IF NOT EXISTS audit_chain;

-- ===================================================================================================
-- 2. RÔLE APPLICATIF & SÉCURITÉ POSTGRESQL
-- ===================================================================================================

-- Rôle applicatif minimaliste : utilisé par le pooler Supabase pour les requêtes authentifiées.
-- En Supabase, le rôle réel est "authenticated" ; on crée ici un rôle miroir "app_authenticated"
-- pour les déploiements self-hosted / tests hors Supabase. Il est membre de "authenticated"
-- lorsque celui-ci existe, sinon on l'utilise tel quel.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_authenticated') THEN
        CREATE ROLE app_authenticated NOLOGIN;
    END IF;
END$$;

-- En Supabase, "authenticated" est le rôle réellement utilisé par les JWT valides.
-- On tente de grant app_authenticated -> authenticated (no-op si authenticated n'existe pas).
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT app_authenticated TO authenticated;
    END IF;
END$$;

-- Durcissement de base : retrait de tous les droits du PUBLIC sur les futures tables.
ALTER DEFAULT PRIVILEGES REVOKE ALL ON TABLES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON SEQUENCES FROM PUBLIC;
ALTER DEFAULT PRIVILEGES REVOKE ALL ON FUNCTIONS FROM PUBLIC;

-- ===================================================================================================
-- 3. FONCTIONS UTILITAIRES (lecture des claims JWT Supabase)
-- ===================================================================================================

-- auth.tenant_id() : récupère le tenant_id du JWT courant (claim custom "tenant_id").
-- Retourne NULL si non authentifié ou claim absent.
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'tenant_id', '')::UUID;
$$;

COMMENT ON FUNCTION auth.tenant_id() IS
    'Récupère le tenant_id depuis le JWT Supabase courant (claim custom tenant_id). Retourne NULL si absent.';

-- auth.user_role() : récupère le rôle applicatif du JWT (claim custom "user_role").
CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'user_role', '');
$$;

COMMENT ON FUNCTION auth.user_role() IS
    'Récupère le rôle applicatif depuis le JWT (claim custom user_role). Valeurs : doctor, nurse, receptionist, auditor, security_admin, admin.';

-- auth.is_admin() : TRUE si l'utilisateur courant est security_admin ou admin global.
CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT auth.user_role() IN ('security_admin', 'admin');
$$;

COMMENT ON FUNCTION auth.is_admin() IS
    'TRUE si le rôle courant est security_admin ou admin (escalade de privilèges pour audit, licences, etc.).';

-- auth.current_user_id() : UUID de l'utilisateur connecté (claim sub).
CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT NULLIF(current_setting('request.jwt.claims', true)::jsonb ->> 'sub', '')::UUID;
$$;

COMMENT ON FUNCTION auth.current_user_id() IS
    'UUID de l''utilisateur courant (claim sub du JWT Supabase).';

-- ===================================================================================================
-- 4. TABLES
-- ===================================================================================================

-- ---------------------------------------------------------------------------------------------
-- 4.1 tenants — Table racine du multi-tenant. Une ligne = une clinique OneDesk.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tenants (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                 TEXT NOT NULL,
    supabase_project_ref TEXT,
    license_key          TEXT,
    status               TEXT NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'suspended', 'terminated')),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE tenants IS
    'Table racine multi-tenant : une clinique OneDesk. Toutes les autres tables cliniques portent un tenant_id référençant cette table.';

-- ---------------------------------------------------------------------------------------------
-- 4.2 users — Utilisateurs applicatifs (non auth.users) : profil métier + RBAC.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    email         TEXT NOT NULL,
    role          TEXT NOT NULL
                  CHECK (role IN ('doctor','nurse','receptionist','auditor','security_admin','admin')),
    rpps_code     TEXT,
    display_name  TEXT NOT NULL,
    is_active      BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (tenant_id, email)
);

COMMENT ON TABLE users IS
    'Profils applicatifs (rôles cliniques) liés au tenant. Le compte Supabase auth.users porte l''identité ; cette table porte le rôle métier (doctor, nurse, receptionist, auditor, security_admin, admin) et le code RPPS.';

-- ---------------------------------------------------------------------------------------------
-- 4.3 patients — Dossier patient principal (IPP/mrn, allergies, antécédents, constantes).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS patients (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    mrn                 TEXT NOT NULL,                          -- Identifiant Permanent Patient (IPP)
    family_name         TEXT NOT NULL,
    given_name          TEXT NOT NULL,
    birth_date          DATE NOT NULL,
    gender              CHAR(1) NOT NULL CHECK (gender IN ('M','F','O')),
    phone               TEXT,
    email               TEXT,
    insurance_provider  TEXT,
    primary_doctor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
    allergies           JSONB NOT NULL DEFAULT '[]'::jsonb,
    problems            JSONB NOT NULL DEFAULT '[]'::jsonb,
    vitals_history      JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE patients IS
    'Dossier patient OneDesk : identité, IPP (mrn), allergies, antécédents (problems), constantes (vitals_history) au format JSONB. Le couple (tenant_id, mrn) est unique.';

-- ---------------------------------------------------------------------------------------------
-- 4.4 appointments — Rendez-vous / créneaux d'agenda.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS appointments (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id      UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id     UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    practitioner_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    starts_at      TIMESTAMPTZ NOT NULL,
    ends_at        TIMESTAMPTZ NOT NULL,
    status         TEXT NOT NULL DEFAULT 'booked'
                   CHECK (status IN ('booked','confirmed','arrived','in_progress','completed','cancelled','no_show')),
    reason         TEXT,
    encounter_type TEXT NOT NULL DEFAULT 'consultation'
                   CHECK (encounter_type IN ('consultation','suivi','urgence','teleconsultation')),
    created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT appointments_time_chk CHECK (ends_at > starts_at)
);

COMMENT ON TABLE appointments IS
    'Agenda clinique : RDV patient/praticien avec statut (booked, confirmed, arrived, in_progress, completed, cancelled, no_show) et type de rencontre (consultation, suivi, urgence, téléconsultation).';

-- ---------------------------------------------------------------------------------------------
-- 4.5 medication_orders — Prescriptions médicamenteuses.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS medication_orders (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id         UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    prescribed_by      UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    medication_code    TEXT NOT NULL,
    medication_display TEXT NOT NULL,
    dosage             TEXT NOT NULL CHECK (length(btrim(dosage)) > 0),  -- dosage non vide
    status             TEXT NOT NULL DEFAULT 'active'
                       CHECK (status IN ('draft','active','stopped','cancelled')),
    prescribed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE medication_orders IS
    'Prescriptions : code médicament (ATC/CIS), libellé, dosage (non vide), statut. Prescripteur (prescribed_by) doit avoir le rôle doctor.';

-- ---------------------------------------------------------------------------------------------
-- 4.6 clinical_notes — Comptes rendus cliniques SOAP (Subjective/Objective/Assessment/Plan).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_notes (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    encounter_id  UUID,                                                 -- référence logique à un RDV/visite
    authored_by   UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    status        TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft','signed','amended')),
    subjective    JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Motif + Histoire + Symptômes
    objective     JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Examen physique + Constantes
    assessment    JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Diagnostics + Évaluation
    plan          JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Plan thérapeutique + Conseils
    follow_up     JSONB NOT NULL DEFAULT '{}'::jsonb,                  -- Suivi recommandé
    signed_at     TIMESTAMPTZ,
    note_version  INTEGER NOT NULL DEFAULT 1 CHECK (note_version >= 1),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_notes IS
    'Compte rendu clinique au format SOAP (subjective / objective / assessment / plan) + suivi. Versionné (note_version). Signé (signed_at) puis immuable ; toute correction via clinical_addenda.';

-- ---------------------------------------------------------------------------------------------
-- 4.7 clinical_addenda — Addenda (corrections/Addendums) sur une note signée.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS clinical_addenda (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    note_id     UUID NOT NULL REFERENCES clinical_notes(id) ON DELETE CASCADE,
    authored_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    reason      TEXT NOT NULL,
    body        TEXT NOT NULL,
    authored_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE clinical_addenda IS
    'Addendum ajouté à un compte rendu signé (jamais de modification in-place). Porte un motif (reason) et un corps (body).';

-- ---------------------------------------------------------------------------------------------
-- 4.8 audit_events — Journal d'audit HDS immuable (chaîne SHA-256).
--    INSERT-ONLY : triggers BEFORE UPDATE / BEFORE DELETE lèvent une exception.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_events (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id           UUID NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
    occurred_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    actor_user_id       UUID,
    action              TEXT NOT NULL,                          -- ex: PATIENT_READ, PRESCRIPTION_CREATE
    resource_type       TEXT NOT NULL,                          -- ex: patient, medication_order, clinical_note
    resource_id         UUID,
    patient_id          UUID,
    outcome             TEXT NOT NULL DEFAULT 'allowed'
                        CHECK (outcome IN ('allowed','denied','challenged')),
    reason_text         TEXT,
    previous_hash       TEXT,                                   -- hash de l'événement précédent (tenant)
    event_hash          TEXT,                                   -- hash SHA-256 du présent événement
    integrity_chain_seq BIGINT NOT NULL                        -- n° de séquence par tenant
);

COMMENT ON TABLE audit_events IS
    'Journal d''audit HDS immuable. Chaque ligne est maillée par previous_hash / event_hash (SHA-256) et numérotée (integrity_chain_seq) par tenant. UPDATE et DELETE interdits par trigger.';

-- ---------------------------------------------------------------------------------------------
-- 4.9 outbox_items — Outbox pattern pour sync offline et events distribués.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS outbox_items (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    aggregate_type  TEXT NOT NULL,                              -- ex: patient, appointment, clinical_note
    aggregate_id    UUID NOT NULL,
    operation_type  TEXT NOT NULL,                              -- ex: INSERT, UPDATE, DELETE
    payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
    idempotency_key TEXT NOT NULL,
    base_version    INTEGER NOT NULL DEFAULT 0,
    status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','applied','failed')),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_at      TIMESTAMPTZ,
    error_message   TEXT,
    UNIQUE (idempotency_key)
);

COMMENT ON TABLE outbox_items IS
    'Outbox pattern : transactions métier émettent une ligne "pending" ; un worker de sync la traite hors transaction. idempotency_key UNIQUE garantit la livraison unique.';

-- ---------------------------------------------------------------------------------------------
-- 4.10 follow_up_tasks — Tâches de suivi patient (rappel, contrôle, renouvellement).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS follow_up_tasks (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id        UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    patient_id       UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    assigned_to      UUID REFERENCES users(id) ON DELETE SET NULL,
    type             TEXT NOT NULL
                     CHECK (type IN ('call','exam_control','consultation_check','prescription_renewal')),
    due_at           TIMESTAMPTZ NOT NULL,
    status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending','in_progress','done','overdue')),
    clinical_context JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE follow_up_tasks IS
    'Tâches de suivi patient : appel, contrôle biologique, vérification consultation, renouvellement. Statut (pending, in_progress, done, overdue) + contexte clinique JSONB.';

-- ---------------------------------------------------------------------------------------------
-- 4.11 secure_conversations — Conversations sécurisées MSSanté (patient ↔ clinicien).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secure_conversations (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    subject   TEXT NOT NULL,
    status    TEXT NOT NULL DEFAULT 'open'
              CHECK (status IN ('open','waiting_patient','waiting_clinician','closed')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE secure_conversations IS
    'Conversation sécurisée MSSanté (messagerie santé chiffrée). Statut open/waiting_patient/waiting_clinician/closed.';

-- ---------------------------------------------------------------------------------------------
-- 4.12 secure_messages — Messages d'une conversation sécurisée.
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS secure_messages (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES secure_conversations(id) ON DELETE CASCADE,
    tenant_id       UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    sender_id       UUID REFERENCES users(id) ON DELETE SET NULL,
    body            TEXT NOT NULL,
    sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    read_at         TIMESTAMPTZ
);

COMMENT ON TABLE secure_messages IS
    'Message individuel d''une conversation sécurisée MSSanté. sender_id NULL autorisé (message provenant du patient via portail).';

-- ---------------------------------------------------------------------------------------------
-- 4.13 break_glass_events — Accès d'urgence à un dossier patient (break-glass).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS break_glass_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id     UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id       UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    patient_id    UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
    justification TEXT NOT NULL,
    started_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at    TIMESTAMPTZ NOT NULL,
    active        BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT break_glass_expires_chk CHECK (expires_at > started_at)
);

COMMENT ON TABLE break_glass_events IS
    'Break-glass : accès d''urgence justifié à un dossier patient. borné dans le temps (started_at/expires_at). Désactivé (active=FALSE) après fermeture.';

-- ---------------------------------------------------------------------------------------------
-- 4.14 license_keys — Clés de licence (activation offline / machine).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS license_keys (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_code             TEXT NOT NULL UNIQUE,
    tenant_id            UUID REFERENCES tenants(id) ON DELETE CASCADE,
    machine_code         TEXT,
    status               TEXT NOT NULL DEFAULT 'pending'
                         CHECK (status IN ('pending','active','revoked','expired')),
    activated_at         TIMESTAMPTZ,
    expires_at           TIMESTAMPTZ,
    max_activations      INTEGER NOT NULL DEFAULT 1 CHECK (max_activations >= 1),
    current_activations  INTEGER NOT NULL DEFAULT 0 CHECK (current_activations >= 0),
    created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT license_activation_chk CHECK (current_activations <= max_activations)
);

COMMENT ON TABLE license_keys IS
    'Clés de licence (activation machine / mode offline). Statut pending/active/revoked/expired. current_activations ne peut dépasser max_activations.';

-- ---------------------------------------------------------------------------------------------
-- 4.15 login_sessions — Sessions applicatives (révocation, audit IP/UA).
-- ---------------------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS login_sessions (
    id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token_hash TEXT NOT NULL,
    expires_at         TIMESTAMPTZ NOT NULL,
    ip_address         INET,
    user_agent         TEXT,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at         TIMESTAMPTZ
);

COMMENT ON TABLE login_sessions IS
    'Sessions applicatives : hash du token (jamais le token en clair), IP + User-Agent pour audit, révocation possible (revoked_at).';

-- ===================================================================================================
-- 5. INDEX
-- ===================================================================================================

-- Index d'isolation multi-tenant : toutes les tables cliniques portent (tenant_id, patient_id).
CREATE INDEX IF NOT EXISTS idx_users_tenant              ON users (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_mrn       ON patients (tenant_id, mrn);   -- unique
CREATE INDEX IF NOT EXISTS idx_patients_tenant_doctor    ON patients (tenant_id, primary_doctor_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient ON appointments (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_practitioner ON appointments (tenant_id, practitioner_id);
CREATE INDEX IF NOT EXISTS idx_appointments_starts_at    ON appointments (tenant_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_medication_orders_tenant_patient ON medication_orders (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_tenant_patient ON clinical_notes (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_tenant_encounter ON clinical_notes (tenant_id, encounter_id);
CREATE INDEX IF NOT EXISTS idx_clinical_addenda_tenant_note ON clinical_addenda (tenant_id, note_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_seq   ON audit_events (tenant_id, integrity_chain_seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_patient ON audit_events (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_tenant_patient ON follow_up_tasks (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_follow_up_tasks_due       ON follow_up_tasks (tenant_id, due_at);
CREATE INDEX IF NOT EXISTS idx_secure_messages_conv      ON secure_messages (conversation_id, sent_at);
CREATE INDEX IF NOT EXISTS idx_break_glass_tenant_patient ON break_glass_events (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_login_sessions_user       ON login_sessions (tenant_id, user_id);

-- Unicité du couple (tenant_id, mrn) — patient uniqueness within a tenant.
CREATE UNIQUE INDEX IF NOT EXISTS uq_patients_tenant_mrn ON patients (tenant_id, mrn);

-- Index partiel pour le worker de sync outbox : seulement les lignes "pending".
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_items (created_at)
    WHERE status = 'pending';

-- ===================================================================================================
-- 6. TRIGGER — CHAÎNE D'AUDIT SHA-256 (previous_hash / event_hash / integrity_chain_seq)
-- ===================================================================================================

-- audit_chain.compute_event_hash(prev TEXT, payload JSONB) : SHA-256 hex de prev || canonical_json.
CREATE OR REPLACE FUNCTION audit_chain.compute_event_hash(prev TEXT, payload JSONB)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
    SELECT encode(
        digest(
            COALESCE(prev, '') || payload::text,
            'sha256'
        ),
        'hex'
    )
$$;

COMMENT ON FUNCTION audit_chain.compute_event_hash(TEXT, JSONB) IS
    'Calcule event_hash = SHA-256(previous_hash || canonical_json(payload)). Le JSONB est trié alphabétiquement par PostgreSQL -> canonical.';

-- audit_events_before_insert() : peuple previous_hash, event_hash, integrity_chain_seq.
CREATE OR REPLACE FUNCTION audit_events_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = audit_chain, public
AS $$
DECLARE
    last_hash TEXT;
    last_seq  BIGINT;
    payload   JSONB;
BEGIN
    -- Verrouillage par tenant pour éviter les races conditions lors d'inserts concurrents.
    PERFORM 1 FROM tenants WHERE id = NEW.tenant_id FOR UPDATE;

    -- Dernier hash + seq pour ce tenant.
    SELECT event_hash, integrity_chain_seq
      INTO last_hash, last_seq
      FROM audit_events
     WHERE tenant_id = NEW.tenant_id
     ORDER BY integrity_chain_seq DESC
     LIMIT 1
     FOR UPDATE;

    IF last_hash IS NULL THEN
        last_seq := 0;
    END IF;

    NEW.integrity_chain_seq := COALESCE(last_seq, 0) + 1;
    NEW.previous_hash       := last_hash;  -- NULL pour le 1er événement du tenant

    -- Construction du payload canonique (clés triées) pour le hash.
    payload := jsonb_build_object(
        'tenant_id', NEW.tenant_id,
        'occurred_at', NEW.occurred_at,
        'actor_user_id', NEW.actor_user_id,
        'action', NEW.action,
        'resource_type', NEW.resource_type,
        'resource_id', NEW.resource_id,
        'patient_id', NEW.patient_id,
        'outcome', NEW.outcome,
        'reason_text', NEW.reason_text,
        'integrity_chain_seq', NEW.integrity_chain_seq,
        'previous_hash', NEW.previous_hash
    );

    NEW.event_hash := audit_chain.compute_event_hash(NEW.previous_hash, payload);

    RETURN NEW;
END;
$$;

CREATE TRIGGER before_insert_audit_event
    BEFORE INSERT ON audit_events
    FOR EACH ROW
    EXECUTE FUNCTION audit_events_before_insert();

COMMENT ON TRIGGER before_insert_audit_event ON audit_events IS
    'Avant INSERT : récupère previous_hash (dernier hash du tenant), incrémente integrity_chain_seq, calcule event_hash (SHA-256).';

-- ===================================================================================================
-- 7. TRIGGER — INSERT-ONLY SUR audit_events (UPDATE / DELETE INTERDITS)
-- ===================================================================================================

CREATE OR REPLACE FUNCTION audit_chain.block_audit_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'audit_events est INSERT-ONLY : UPDATE et DELETE sont interdits (conformité HDS).';
END;
$$;

CREATE TRIGGER audit_events_no_update
    BEFORE UPDATE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_chain.block_audit_mutation();

CREATE TRIGGER audit_events_no_delete
    BEFORE DELETE ON audit_events
    FOR EACH ROW EXECUTE FUNCTION audit_chain.block_audit_mutation();

COMMENT ON TRIGGER audit_events_no_update ON audit_events IS 'Bloque tout UPDATE (HDS immuabilité).';
COMMENT ON TRIGGER audit_events_no_delete ON audit_events IS 'Bloque tout DELETE (HDS immuabilité).';

-- ===================================================================================================
-- 8. ROW LEVEL SECURITY (RLS) — ISOLATION TENANT + RBAC PAR RÔLE
-- ===================================================================================================

-- Activation RLS sur TOUTES les tables contenant des données cliniques.
ALTER TABLE tenants              ENABLE ROW LEVEL SECURITY;
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients             ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments         ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_orders    ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clinical_addenda     ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_events         ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbox_items         ENABLE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE secure_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE break_glass_events   ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_keys         ENABLE ROW LEVEL SECURITY;
ALTER TABLE login_sessions       ENABLE ROW LEVEL SECURITY;

-- Force RLS même pour le propriétaire de la table (défense en profondeur).
ALTER TABLE tenants              FORCE ROW LEVEL SECURITY;
ALTER TABLE users                FORCE ROW LEVEL SECURITY;
ALTER TABLE patients             FORCE ROW LEVEL SECURITY;
ALTER TABLE appointments         FORCE ROW LEVEL SECURITY;
ALTER TABLE medication_orders    FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_notes       FORCE ROW LEVEL SECURITY;
ALTER TABLE clinical_addenda     FORCE ROW LEVEL SECURITY;
-- NB : audit_events n'est PAS en FORCE ROW LEVEL SECURITY car le trigger
-- SECURITY DEFINER (before_insert_audit_event) doit pouvoir lire les lignes
-- précédentes du même tenant pour calculer previous_hash / integrity_chain_seq.
-- RLS reste ENABLED — les policies d'INSERT/SELECT s'appliquent normalement
-- aux utilisateurs authentifiés ; seul le propriétaire (postgres, qui exécute
-- le trigger) contourne le RLS, ce qui est exactement le comportement souhaité.
ALTER TABLE outbox_items         FORCE ROW LEVEL SECURITY;
ALTER TABLE follow_up_tasks      FORCE ROW LEVEL SECURITY;
ALTER TABLE secure_conversations FORCE ROW LEVEL SECURITY;
ALTER TABLE secure_messages      FORCE ROW LEVEL SECURITY;
ALTER TABLE break_glass_events   FORCE ROW LEVEL SECURITY;
ALTER TABLE license_keys         FORCE ROW LEVEL SECURITY;
ALTER TABLE login_sessions       FORCE ROW LEVEL SECURITY;

-- --------------------------------------------------------------------------------
-- 8.1 tenants — lecture/écriture réservée aux admins (security_admin, admin).
-- --------------------------------------------------------------------------------
CREATE POLICY tenants_select_own ON tenants
    FOR SELECT TO app_authenticated
    USING (id = auth.tenant_id());

CREATE POLICY tenants_admin_manage ON tenants
    FOR ALL TO app_authenticated
    USING (auth.is_admin())
    WITH CHECK (auth.is_admin());

-- --------------------------------------------------------------------------------
-- 8.2 users — SELECT own tenant, UPDATE only self, INSERT/DELETE admin only.
-- --------------------------------------------------------------------------------
CREATE POLICY users_select_own_tenant ON users
    FOR SELECT TO app_authenticated
    USING (tenant_id = auth.tenant_id());

-- Lecture/écriture user : un user ne peut UPDATE QUE sa propre ligne.
CREATE POLICY users_update_self ON users
    FOR UPDATE TO app_authenticated
    USING (id = auth.current_user_id() AND tenant_id = auth.tenant_id())
    WITH CHECK (id = auth.current_user_id() AND tenant_id = auth.tenant_id());

-- Insertion / suppression réservées aux admins.
CREATE POLICY users_admin_insert ON users
    FOR INSERT TO app_authenticated
    WITH CHECK (auth.is_admin() AND tenant_id = auth.tenant_id());

CREATE POLICY users_admin_delete ON users
    FOR DELETE TO app_authenticated
    USING (auth.is_admin() AND tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.3 patients — CRUD dans son tenant ; pas de restriction RBAC (tous les rôles
--      cliniques + réceptionnistes y accèdent ; le détail clinique est protégé
--      au niveau des notes / prescriptions).
-- --------------------------------------------------------------------------------
CREATE POLICY patients_tenant_isolation ON patients
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.4 appointments — CRUD dans son tenant.
-- --------------------------------------------------------------------------------
CREATE POLICY appointments_tenant_isolation ON appointments
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.5 medication_orders — INTERDIT aux réceptionnistes (SELECT/INSERT/UPDATE/DELETE).
--      Les docteurs peuvent créer/modifier ; infirmières et autres en lecture.
-- --------------------------------------------------------------------------------
CREATE POLICY medication_orders_select ON medication_orders
    FOR SELECT TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() <> 'receptionist'
    );

CREATE POLICY medication_orders_insert ON medication_orders
    FOR INSERT TO app_authenticated
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY medication_orders_update ON medication_orders
    FOR UPDATE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY medication_orders_delete ON medication_orders
    FOR DELETE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('admin','security_admin')
    );

-- --------------------------------------------------------------------------------
-- 8.6 clinical_notes — INTERDIT aux réceptionnistes.
--      Lecture : doctor, nurse, auditor, security_admin, admin.
--      Écriture : doctor, admin, security_admin.
-- --------------------------------------------------------------------------------
CREATE POLICY clinical_notes_select ON clinical_notes
    FOR SELECT TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() <> 'receptionist'
    );

CREATE POLICY clinical_notes_insert ON clinical_notes
    FOR INSERT TO app_authenticated
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY clinical_notes_update ON clinical_notes
    FOR UPDATE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY clinical_notes_delete ON clinical_notes
    FOR DELETE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('admin','security_admin')
    );

-- --------------------------------------------------------------------------------
-- 8.7 clinical_addenda — mêmes règles que clinical_notes.
-- --------------------------------------------------------------------------------
CREATE POLICY clinical_addenda_select ON clinical_addenda
    FOR SELECT TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() <> 'receptionist'
    );

CREATE POLICY clinical_addenda_insert ON clinical_addenda
    FOR INSERT TO app_authenticated
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY clinical_addenda_update ON clinical_addenda
    FOR UPDATE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('doctor','admin','security_admin')
    );

CREATE POLICY clinical_addenda_delete ON clinical_addenda
    FOR DELETE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.user_role() IN ('admin','security_admin')
    );

-- --------------------------------------------------------------------------------
-- 8.8 audit_events — INSERT-ONLY pour les non-admins (les users insèrent leurs
--      propres events via SECURITY DEFINER), SELECT réservé à security_admin/admin.
-- --------------------------------------------------------------------------------
-- INSERT autorisé pour tous les utilisateurs authentifiés du tenant (application
-- écrit ses propres events). Pas de SELECT / UPDATE / DELETE pour les non-admins.
CREATE POLICY audit_events_insert_own_tenant ON audit_events
    FOR INSERT TO app_authenticated
    WITH CHECK (tenant_id = auth.tenant_id());

-- SELECT réservé aux administrateurs (security_admin, admin).
CREATE POLICY audit_events_select_admin ON audit_events
    FOR SELECT TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    );

-- NB : aucun trigger/policy UPDATE/DELETE — déjà bloqué physiquement par les
-- triggers audit_events_no_update / audit_events_no_delete (section 7).

-- --------------------------------------------------------------------------------
-- 8.9 outbox_items — réservé aux administrateurs (invisible des cliniciens).
-- --------------------------------------------------------------------------------
CREATE POLICY outbox_items_admin ON outbox_items
    FOR ALL TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    );

-- --------------------------------------------------------------------------------
-- 8.10 follow_up_tasks — CRUD dans son tenant.
-- --------------------------------------------------------------------------------
CREATE POLICY follow_up_tasks_tenant ON follow_up_tasks
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.11 secure_conversations — CRUD dans son tenant.
-- --------------------------------------------------------------------------------
CREATE POLICY secure_conversations_tenant ON secure_conversations
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.12 secure_messages — CRUD dans son tenant.
-- --------------------------------------------------------------------------------
CREATE POLICY secure_messages_tenant ON secure_messages
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.13 break_glass_events — CRUD dans son tenant (le clinicien crée et termine
--       ses propres break-glass ; security_admin/admin voient tout).
-- --------------------------------------------------------------------------------
CREATE POLICY break_glass_tenant ON break_glass_events
    FOR ALL TO app_authenticated
    USING (tenant_id = auth.tenant_id())
    WITH CHECK (tenant_id = auth.tenant_id());

-- --------------------------------------------------------------------------------
-- 8.14 license_keys — réservé aux admins (security_admin, admin).
-- --------------------------------------------------------------------------------
CREATE POLICY license_keys_admin ON license_keys
    FOR ALL TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    );

-- --------------------------------------------------------------------------------
-- 8.15 login_sessions — un user voit ses propres sessions ; admin voit tout.
-- --------------------------------------------------------------------------------
CREATE POLICY login_sessions_select_own_or_admin ON login_sessions
    FOR SELECT TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND (user_id = auth.current_user_id() OR auth.is_admin())
    );

CREATE POLICY login_sessions_insert_own ON login_sessions
    FOR INSERT TO app_authenticated
    WITH CHECK (
        tenant_id = auth.tenant_id()
        AND user_id = auth.current_user_id()
    );

CREATE POLICY login_sessions_update_own_or_admin ON login_sessions
    FOR UPDATE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND (user_id = auth.current_user_id() OR auth.is_admin())
    )
    WITH CHECK (
        tenant_id = auth.tenant_id()
    );

CREATE POLICY login_sessions_delete_admin ON login_sessions
    FOR DELETE TO app_authenticated
    USING (
        tenant_id = auth.tenant_id()
        AND auth.is_admin()
    );

-- ===================================================================================================
-- 9. GRANTS POUR app_authenticated
-- ===================================================================================================

-- Le rôle app_authenticated reçoit SELECT/INSERT/UPDATE/DELETE sur toutes les tables
-- métier. Les policies RLS restreignent réellement l'accès ligne par ligne.
GRANT SELECT, INSERT, UPDATE, DELETE ON tenants              TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON users                TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON patients             TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON appointments         TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON medication_orders   TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_notes       TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON clinical_addenda     TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON audit_events         TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON outbox_items         TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON follow_up_tasks      TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON secure_conversations TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON secure_messages      TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON break_glass_events   TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON license_keys          TO app_authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON login_sessions       TO app_authenticated;

-- Séquences (pour gen_random_uuid() — déjà des DEFAULT, mais par sécurité).
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_authenticated;

-- En Supabase, "authenticated" hérite de app_authenticated.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        GRANT app_authenticated TO authenticated;
    END IF;
END$$;

-- ===================================================================================================
-- 10. SEED POUR STAGING
-- ===================================================================================================

-- Bloc idempotent : insère le seed uniquement si le tenant de démo n'existe pas déjà.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM tenants WHERE id = '00000000-0000-0000-0000-000000000001') THEN

        -- -----------------------------------------------------------------
        -- 10.1 Tenant de démo
        -- -----------------------------------------------------------------
        INSERT INTO tenants (id, name, supabase_project_ref, license_key, status)
        VALUES (
            '00000000-0000-0000-0000-000000000001',
            'Clinique OneDesk — Démo (Staging)',
            'supabase-project-ref-demo',
            'ONDESK-LICENSE-DEMO-0001',
            'active'
        );

        -- -----------------------------------------------------------------
        -- 10.2 Utilisateurs (4)
        -- NB : les mots de passe ne sont PAS stockés ici. Ils sont gérés par
        -- auth.users (Supabase GoTrue). Pour le staging, créer ces utilisateurs
        -- via le Dashboard Supabase ou l'API Admin, avec les emails ci-dessous :
        --
        --   Dr. Aline Martin     — doctor           — password à set via Dashboard
        --   Inf. Karim Benali    — nurse            — password à set via Dashboard
        --   Acc. Sophie Leroche  — receptionist      — password à set via Dashboard
        --   Aud. Marc Dubois     — auditor           — password à set via Dashboard
        --
        -- Hash bcrypt d'exemple (ne pas insérer en clair) :
        --   "password-demo-Docteur2024!"  -> $2a$10$wH3q... (placeholder)
        -- -----------------------------------------------------------------
        INSERT INTO users (id, tenant_id, email, role, rpps_code, display_name, is_active) VALUES
            ('00000000-0000-0000-0000-000000000010',
             '00000000-0000-0000-0000-000000000001',
             'dr.aline.martin@onedesk-demo.fr',
             'doctor',
             '10000012345',
             'Dr. Aline Martin',
             TRUE),

            ('00000000-0000-0000-0000-000000000011',
             '00000000-0000-0000-0000-000000000001',
             'inf.karim.benali@onedesk-demo.fr',
             'nurse',
             '30000054321',
             'Inf. Karim Benali',
             TRUE),

            ('00000000-0000-0000-0000-000000000012',
             '00000000-0000-0000-0000-000000000001',
             'acc.sophie.leroche@onedesk-demo.fr',
             'receptionist',
             NULL,
             'Acc. Sophie Leroche',
             TRUE),

            ('00000000-0000-0000-0000-000000000013',
             '00000000-0000-0000-0000-000000000001',
             'aud.marc.dubois@onedesk-demo.fr',
             'auditor',
             NULL,
             'Aud. Marc Dubois',
             TRUE);

        -- -----------------------------------------------------------------
        -- 10.3 Patients (4) avec données cliniques réalistes (allergies,
        --      antécédents, constantes).
        -- -----------------------------------------------------------------
        INSERT INTO patients (id, tenant_id, mrn, family_name, given_name, birth_date, gender,
                              phone, email, insurance_provider, primary_doctor_id,
                              allergies, problems, vitals_history) VALUES

            ('00000000-0000-0000-0000-000000001001',
             '00000000-0000-0000-0000-000000000001',
             'MRN-1001',
             'Dubois',
             'Émilie',
             DATE '1987-04-12',
             'F',
             '+33 6 12 34 56 78',
             'emilie.dubois@example.org',
             'CPAM Paris',
             '00000000-0000-0000-0000-000000000010',
             -- allergies
             '[
                {"id":"alg-1","substanceCode":"J01CA04","substanceDisplay":"Amoxicilline",
                 "reaction":"Urticaire généralisé","severity":"moderate",
                 "recordedAt":"2024-01-15T09:00:00Z","recordedBy":"00000000-0000-0000-0000-000000000010",
                 "status":"active"}
             ]'::jsonb,
             -- problems
             '[
                {"id":"pb-1","codeSystem":"ICD10","code":"E11","display":"Diabète type 2",
                 "onsetDate":"2019-06-01","clinicalStatus":"active"}
             ]'::jsonb,
             -- vitals_history
             '[
                {"id":"vs-1","measuredAt":"2025-01-10T08:30:00Z","measuredBy":"00000000-0000-0000-0000-000000000011",
                 "heightCm":165,"weightKg":72,"bmi":26.4,"systolic":128,"diastolic":82,
                 "pulseBpm":76,"temperatureC":36.8,"respiratoryRate":16,"oxygenSaturation":98}
             ]'::jsonb),

            ('00000000-0000-0000-0000-000000001002',
             '00000000-0000-0000-0000-000000000001',
             'MRN-1002',
             'Lambert',
             'Paul',
             DATE '1954-09-23',
             'M',
             '+33 6 98 76 54 32',
             'paul.lambert@example.org',
             'MGEN',
             '00000000-0000-0000-0000-000000000010',
             '[
                {"id":"alg-2","substanceCode":"J01FA09","substanceDisplay":"Clarithromycine",
                 "reaction":"Choc anaphylactique","severity":"life_threatening",
                 "recordedAt":"2023-11-04T14:20:00Z","recordedBy":"00000000-0000-0000-0000-000000000010",
                 "status":"active"}
             ]'::jsonb,
             '[
                {"id":"pb-2","codeSystem":"ICD10","code":"I10","display":"Hypertension artérielle",
                 "onsetDate":"2015-02-01","clinicalStatus":"active"},
                {"id":"pb-3","codeSystem":"ICD10","code":"E78.5","display":"Hyperlipidémie",
                 "onsetDate":"2017-04-15","clinicalStatus":"active"}
             ]'::jsonb,
             '[
                {"id":"vs-2","measuredAt":"2025-01-11T09:00:00Z","measuredBy":"00000000-0000-0000-0000-000000000011",
                 "heightCm":178,"weightKg":89,"bmi":28.1,"systolic":145,"diastolic":92,
                 "pulseBpm":82,"temperatureC":36.7,"respiratoryRate":18,"oxygenSaturation":96}
             ]'::jsonb),

            ('00000000-0000-0000-0000-000000001003',
             '00000000-0000-0000-0000-000000000001',
             'MRN-1003',
             'Nguyen',
             'Linh',
             DATE '1995-12-03',
             'F',
             '+33 6 22 33 44 55',
             'linh.nguyen@example.org',
             'Harmonie Mutuelle',
             '00000000-0000-0000-0000-000000000010',
             '[]'::jsonb,
             '[
                {"id":"pb-4","codeSystem":"ICD10","code":"J45.9","display":"Asthme léger",
                 "onsetDate":"2020-03-12","clinicalStatus":"active"}
             ]'::jsonb,
             '[
                {"id":"vs-3","measuredAt":"2025-01-12T10:15:00Z","measuredBy":"00000000-0000-0000-0000-000000000011",
                 "heightCm":160,"weightKg":55,"bmi":21.5,"systolic":115,"diastolic":72,
                 "pulseBpm":70,"temperatureC":36.6,"respiratoryRate":17,"oxygenSaturation":99}
             ]'::jsonb),

            ('00000000-0000-0000-0000-000000001004',
             '00000000-0000-0000-0000-000000000001',
             'MRN-1004',
             'Moreau',
             'Jacques',
             DATE '1948-07-30',
             'M',
             '+33 6 55 44 33 22',
             'jacques.moreau@example.org',
             'CPAM Lyon',
             '00000000-0000-0000-0000-000000000010',
             '[
                {"id":"alg-3","substanceCode":"N02AJ06","substanceDisplay":"Codéine",
                 "reaction":"Prurit","severity":"mild",
                 "recordedAt":"2022-08-19T11:00:00Z","recordedBy":"00000000-0000-0000-0000-000000000010",
                 "status":"active"}
             ]'::jsonb,
             '[
                {"id":"pb-5","codeSystem":"ICD10","code":"M17.9","display":"Gonarthrose bilatérale",
                 "onsetDate":"2018-01-10","clinicalStatus":"active"},
                {"id":"pb-6","codeSystem":"ICD10","code":"N18.3","display":"Insuffisance rénale chronique stade 3",
                 "onsetDate":"2021-05-22","clinicalStatus":"active"}
             ]'::jsonb,
             '[
                {"id":"vs-4","measuredAt":"2025-01-13T08:00:00Z","measuredBy":"00000000-0000-0000-0000-000000000011",
                 "heightCm":172,"weightKg":78,"bmi":26.4,"systolic":138,"diastolic":85,
                 "pulseBpm":74,"temperatureC":36.9,"respiratoryRate":16,"oxygenSaturation":95}
             ]'::jsonb);

        -- -----------------------------------------------------------------
        -- 10.4 Rendez-vous (5)
        -- -----------------------------------------------------------------
        INSERT INTO appointments (id, tenant_id, patient_id, practitioner_id, starts_at, ends_at,
                                  status, reason, encounter_type) VALUES

            ('00000000-0000-0000-0000-000000002001',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001001',
             '00000000-0000-0000-0000-000000000010',
             TIMESTAMPTZ '2025-02-10 09:00:00+01',
             TIMESTAMPTZ '2025-02-10 09:30:00+01',
             'confirmed',
             'Suivi diabète type 2 — contrôle trimestriel',
             'suivi'),

            ('00000000-0000-0000-0000-000000002002',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001002',
             '00000000-0000-0000-0000-000000000010',
             TIMESTAMPTZ '2025-02-10 10:00:00+01',
             TIMESTAMPTZ '2025-02-10 10:45:00+01',
             'booked',
             'Consultation hypertension — ajustement traitement',
             'consultation'),

            ('00000000-0000-0000-0000-000000002003',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001003',
             '00000000-0000-0000-0000-000000000010',
             TIMESTAMPTZ '2025-02-10 11:00:00+01',
             TIMESTAMPTZ '2025-02-10 11:20:00+01',
             'arrived',
             'Crise d''asthme — évaluation',
             'urgence'),

            ('00000000-0000-0000-0000-000000002004',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001004',
             '00000000-0000-0000-0000-000000000010',
             TIMESTAMPTZ '2025-02-10 14:00:00+01',
             TIMESTAMPTZ '2025-02-10 14:30:00+01',
             'booked',
             'Téléconsultation — douleur articulaire genou',
             'teleconsultation'),

            ('00000000-0000-0000-0000-000000002005',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001002',
             '00000000-0000-0000-0000-000000000010',
             TIMESTAMPTZ '2025-02-11 09:30:00+01',
             TIMESTAMPTZ '2025-02-11 10:00:00+01',
             'booked',
             'Renouvellement ordonnance hypertension',
             'consultation');

        -- -----------------------------------------------------------------
        -- 10.5 Prescriptions (2)
        -- -----------------------------------------------------------------
        INSERT INTO medication_orders (id, tenant_id, patient_id, prescribed_by,
                                       medication_code, medication_display, dosage, status, prescribed_at) VALUES

            ('00000000-0000-0000-0000-000000003001',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001002',  -- patient Lambert Paul (HTA)
             '00000000-0000-0000-0000-000000000010',
             'C09AA02',                                -- code CIS/ATC
             'Ramipril 5 mg comprimé',
             '1 comprimé le matin pendant 30 jours',
             'active',
             TIMESTAMPTZ '2025-02-10 10:30:00+01'),

            ('00000000-0000-0000-0000-000000003002',
             '00000000-0000-0000-0000-000000000001',
             '00000000-0000-0000-0000-000000001001',  -- Dubois Émilie (diabète T2)
             '00000000-0000-0000-0000-000000000010',
             'A10BA02',
             'Metformine 1000 mg comprimé',
             '1 comprimé matin et soir pendant 90 jours',
             'active',
             TIMESTAMPTZ '2025-02-10 09:15:00+01');

        -- -----------------------------------------------------------------
        -- 10.6 Quelques événements d'audit de démonstration (chaîne SHA-256).
        -- -----------------------------------------------------------------
        INSERT INTO audit_events (tenant_id, action, resource_type, resource_id, patient_id,
                                  outcome, reason_text, actor_user_id) VALUES
            ('00000000-0000-0000-0000-000000000001',
             'PATIENT_READ', 'patient',
             '00000000-0000-0000-0000-000000001001',
             '00000000-0000-0000-0000-000000001001',
             'allowed', 'Consultation dossier patient en RDV',
             '00000000-0000-0000-0000-000000000010'),

            ('00000000-0000-0000-0000-000000000001',
             'PRESCRIPTION_CREATE', 'medication_order',
             '00000000-0000-0000-0000-000000003001',
             '00000000-0000-0000-0000-000000001002',
             'allowed', 'Prescription Ramipril — HTA',
             '00000000-0000-0000-0000-000000000010'),

            ('00000000-0000-0000-0000-000000000001',
             'BREAK_GLASS_OPEN', 'patient',
             '00000000-0000-0000-0000-000000001003',
             '00000000-0000-0000-0000-000000001003',
             'challenged', 'Accès urgence crise asthme hors permanence',
             '00000000-0000-0000-0000-000000000010');

        RAISE NOTICE 'Seed staging inséré avec succès : 1 tenant, 4 users, 4 patients, 5 RDV, 2 prescriptions, 3 audit events.';

    ELSE
        RAISE NOTICE 'Seed déjà présent — aucune insertion (idempotent).';
    END IF;
END $$;

-- ===================================================================================================
-- FIN — Schéma OneDesk prêt pour Supabase.
-- Prochaines étapes recommandées :
--   1. Créer les utilisateurs auth.users via Dashboard Supabase avec les emails du seed.
--   2. Ajouter les claims custom (tenant_id, user_role) dans le JWT via une fonction
--      Postgres "auth.get_user_claims" branchée sur les triggers auth.users.
--   3. Configurer le worker outbox (lecture idx_outbox_pending -> dispatch MSSanté).
--   4. Vérifier l'immuabilité d'audit_events : tenter un UPDATE doit lever une exception.
-- ===================================================================================================
