-- ============================================================
-- ONEDESK — SCHÉMA COMPLET (Free Tier Supabase compatible)
-- Version consolidée : schema.sql + auth-migration.sql fusionnés
-- Exécutable en une seule fois dans le SQL Editor Supabase.
-- ============================================================

-- ============================================================
-- 0. EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. TABLE TENANTS (multi-tenant)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  supabase_project_ref TEXT,
  license_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. TABLE USERS (profils cliniques — liés à auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Lien avec Supabase Auth (auth.users.id)
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'auditor', 'security_admin', 'admin')),
  rpps_code TEXT,
  department TEXT NOT NULL DEFAULT 'À confirmer',
  service_code TEXT NOT NULL DEFAULT 'PENDING',
  is_active BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_role ON public.users (tenant_id, role);

-- ============================================================
-- 3. TABLE PATIENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  medical_record_number TEXT NOT NULL,
  family_name TEXT NOT NULL,
  given_name TEXT NOT NULL,
  birth_date DATE NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('M', 'F', 'O')),
  phone TEXT,
  email TEXT,
  address JSONB DEFAULT '{}'::jsonb,
  blood_group TEXT,
  emergency_contact JSONB DEFAULT '{}'::jsonb,
  insurance JSONB DEFAULT '{}'::jsonb,
  allergies JSONB DEFAULT '[]'::jsonb,
  problems JSONB DEFAULT '[]'::jsonb,
  vitals_history JSONB DEFAULT '[]'::jsonb,
  medical_history JSONB DEFAULT '[]'::jsonb,
  surgical_history JSONB DEFAULT '[]'::jsonb,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'merged', 'deceased')),
  primary_doctor_id UUID REFERENCES public.users(id),
  primary_doctor_name TEXT,
  last_visit_date TIMESTAMPTZ,
  tags JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_patients_tenant ON public.patients (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_patients_tenant_mrn ON public.patients (tenant_id, medical_record_number);
CREATE INDEX IF NOT EXISTS idx_patients_doctor ON public.patients (tenant_id, primary_doctor_id);

-- ============================================================
-- 4. TABLE APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  patient_mrn TEXT,
  practitioner_id UUID NOT NULL REFERENCES public.users(id),
  practitioner_name TEXT NOT NULL,
  service_code TEXT NOT NULL DEFAULT 'CONSULT',
  appointment_type TEXT NOT NULL DEFAULT 'consultation' CHECK (appointment_type IN ('consultation', 'suivi', 'urgence', 'teleconsultation')),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'booked' CHECK (status IN ('booked', 'confirmed', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show')),
  reason TEXT DEFAULT '',
  room_code TEXT DEFAULT '',
  priority SMALLINT NOT NULL DEFAULT 0 CHECK (priority IN (0, 1, 2)),
  queue_ticket_id UUID,
  encounter_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_ends_after_starts CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_practitioner ON public.appointments (tenant_id, practitioner_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient ON public.appointments (tenant_id, patient_id, starts_at);

-- ============================================================
-- 5. TABLE CLINICAL_NOTES (SOAP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  subjective JSONB DEFAULT '{}'::jsonb,
  objective JSONB DEFAULT '{}'::jsonb,
  assessment JSONB DEFAULT '{}'::jsonb,
  plan JSONB DEFAULT '{}'::jsonb,
  follow_up JSONB DEFAULT '{}'::jsonb,
  note_version INTEGER NOT NULL DEFAULT 1,
  authored_by UUID NOT NULL REFERENCES public.users(id),
  authored_by_name TEXT NOT NULL,
  authored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES public.users(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'signed', 'amended')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_tenant_patient ON public.clinical_notes (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_clinical_notes_status ON public.clinical_notes (tenant_id, status);

-- ============================================================
-- 6. TABLE CLINICAL_ADDENDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinical_addenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  encounter_id UUID NOT NULL,
  original_note_id UUID NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  text TEXT NOT NULL,
  reason TEXT NOT NULL,
  authored_by UUID NOT NULL REFERENCES public.users(id),
  authored_by_name TEXT NOT NULL,
  authored_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_note ON public.clinical_addenda (tenant_id, original_note_id);

-- ============================================================
-- 7. TABLE MEDICATION_CATALOG (catalogue de référence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medication_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  atc_code TEXT,
  display_name TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  category TEXT,
  form TEXT,
  strength TEXT,
  standard_dose TEXT,
  standard_frequency TEXT,
  standard_duration_days INTEGER,
  route_options JSONB DEFAULT '[]'::jsonb,
  active_substances JSONB DEFAULT '[]'::jsonb,
  allergen_class_codes JSONB DEFAULT '[]'::jsonb,
  is_narcotic BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 8. TABLE MEDICATION_ORDERS (prescriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medication_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id UUID,
  medication_id UUID REFERENCES public.medication_catalog(id),
  medication_display TEXT NOT NULL,
  generic_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  route TEXT NOT NULL,
  frequency TEXT NOT NULL,
  duration_days INTEGER NOT NULL CHECK (duration_days > 0),
  quantity TEXT NOT NULL,
  refills INTEGER NOT NULL DEFAULT 0,
  patient_instructions TEXT DEFAULT '',
  clinical_indication TEXT DEFAULT '',
  prescriber_id UUID NOT NULL REFERENCES public.users(id),
  prescriber_name TEXT NOT NULL,
  authored_on TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'stopped', 'cancelled')),
  signed_at TIMESTAMPTZ,
  signed_by UUID REFERENCES public.users(id),
  override_reason TEXT,
  rule_warnings JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_orders_tenant_patient ON public.medication_orders (tenant_id, patient_id, status);

-- ============================================================
-- 9. TABLE AUDIT_EVENTS (INSERT-ONLY, chaîne SHA-256)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_user_id UUID REFERENCES public.users(id),
  actor_name TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  patient_id UUID REFERENCES public.patients(id),
  patient_name TEXT,
  outcome TEXT NOT NULL DEFAULT 'allowed' CHECK (outcome IN ('allowed', 'denied', 'challenged', 'error')),
  reason_text TEXT,
  -- Champs cryptographiques (chaîne SHA-256)
  previous_hash TEXT,
  event_hash TEXT,
  integrity_chain_seq INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant ON public.audit_events (tenant_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_audit_events_seq ON public.audit_events (tenant_id, integrity_chain_seq);

-- ============================================================
-- 10. TABLE OUTBOX_ITEMS (sync bidirectionnelle)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  operation_type TEXT NOT NULL CHECK (operation_type IN ('INSERT', 'UPDATE', 'DELETE')),
  payload JSONB NOT NULL,
  base_version INTEGER NOT NULL DEFAULT 1,
  idempotency_key TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'conflict')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  applied_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE INDEX IF NOT EXISTS idx_outbox_tenant_status ON public.outbox_items (tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_items (status, created_at) WHERE status = 'pending';

-- ============================================================
-- 11. TABLE FOLLOW_UP_TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  patient_name TEXT NOT NULL,
  assigned_to_name TEXT NOT NULL,
  assigned_to_id UUID NOT NULL REFERENCES public.users(id),
  task_type TEXT NOT NULL CHECK (task_type IN ('call', 'exam_control', 'consultation_check', 'prescription_renewal')),
  title TEXT NOT NULL,
  objective TEXT DEFAULT '',
  due_at TIMESTAMPTZ NOT NULL,
  priority TEXT NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine', 'important', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'done', 'overdue')),
  last_contact_at TIMESTAMPTZ,
  outcome_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_tenant_assignee ON public.follow_up_tasks (tenant_id, assigned_to_id, status);

-- ============================================================
-- 12. TABLES MESSAGERIE SÉCURISÉE
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secure_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.secure_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.secure_conversations(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('doctor', 'patient', 'system')),
  sender_name TEXT NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('queued', 'sent', 'delivered', 'read')),
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.secure_messages (tenant_id, conversation_id, sent_at);

-- ============================================================
-- 13. TABLE BREAK_GLASS_EVENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.break_glass_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  patient_name TEXT NOT NULL,
  reason TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_breakglass_tenant_active ON public.break_glass_events (tenant_id, active);

-- ============================================================
-- 14. TRIGGER updated_at automatique
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_updated ON public.users;
CREATE TRIGGER trg_users_updated BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_patients_updated ON public.patients;
CREATE TRIGGER trg_patients_updated BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON public.appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_clinical_notes_updated ON public.clinical_notes;
CREATE TRIGGER trg_clinical_notes_updated BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS trg_medication_orders_updated ON public.medication_orders;
CREATE TRIGGER trg_medication_orders_updated BEFORE UPDATE ON public.medication_orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- 15. FONCTIONS D'AUTH (dans public., pas dans auth.)
-- ============================================================
-- Utilisent auth.uid() natif Supabase → IMPOSSIBLE à forger.
-- Lookup : auth.uid() → public.users.auth_user_id → tenant_id + role.

CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role::TEXT FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.auth_user_role() IN ('admin', 'security_admin');
$$;

CREATE OR REPLACE FUNCTION public.auth_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- ============================================================
-- 16. TRIGGER auto-création profil à l'inscription
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (
    auth_user_id,
    email,
    username,
    display_name,
    role,
    department,
    service_code,
    is_active
  ) VALUES (
    NEW.id,
    NEW.email,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'doctor',
    'À confirmer',
    'PENDING',
    FALSE
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

-- ============================================================
-- 17. ENABLE RLS sur toutes les tables
-- ============================================================
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clinical_addenda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_up_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.secure_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.break_glass_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.medication_catalog ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 18. POLITIQUES RLS
-- ============================================================

-- TENANTS : lecture pour tous les authentifiés
DROP POLICY IF EXISTS tenants_select ON public.tenants;
CREATE POLICY tenants_select ON public.tenants
  FOR SELECT USING (true);

-- USERS : un user voit son propre profil + admin voit tout son tenant
DROP POLICY IF EXISTS users_select_own ON public.users;
CREATE POLICY users_select_own ON public.users
  FOR SELECT USING (
    auth_user_id = auth.uid()
    OR (public.auth_is_admin() AND tenant_id = public.auth_tenant_id())
  );

DROP POLICY IF EXISTS users_update_own ON public.users;
CREATE POLICY users_update_own ON public.users
  FOR UPDATE
  USING (auth_user_id = auth.uid())
  WITH CHECK (
    auth_user_id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid())
  );

-- PATIENTS : isolation par tenant_id
DROP POLICY IF EXISTS patients_tenant_isolation ON public.patients;
CREATE POLICY patients_tenant_isolation ON public.patients
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- APPOINTMENTS
DROP POLICY IF EXISTS appointments_tenant_isolation ON public.appointments;
CREATE POLICY appointments_tenant_isolation ON public.appointments
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- CLINICAL_NOTES : réceptionnistes exclus
DROP POLICY IF EXISTS clinical_notes_tenant_isolation ON public.clinical_notes;
CREATE POLICY clinical_notes_tenant_isolation ON public.clinical_notes
  FOR ALL USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_user_role() NOT IN ('receptionist')
  );

-- CLINICAL_ADDENDA
DROP POLICY IF EXISTS clinical_addenda_tenant_isolation ON public.clinical_addenda;
CREATE POLICY clinical_addenda_tenant_isolation ON public.clinical_addenda
  FOR ALL USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_user_role() NOT IN ('receptionist')
  );

-- MEDICATION_ORDERS : réceptionnistes exclus
DROP POLICY IF EXISTS medication_orders_tenant_isolation ON public.medication_orders;
CREATE POLICY medication_orders_tenant_isolation ON public.medication_orders
  FOR ALL USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_user_role() NOT IN ('receptionist')
  );

-- AUDIT_EVENTS : INSERT pour tous, SELECT pour admin/auditor/security_admin
DROP POLICY IF EXISTS audit_events_insert ON public.audit_events;
CREATE POLICY audit_events_insert ON public.audit_events
  FOR INSERT WITH CHECK (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS audit_events_select ON public.audit_events;
CREATE POLICY audit_events_select ON public.audit_events
  FOR SELECT USING (
    tenant_id = public.auth_tenant_id()
    AND public.auth_user_role() IN ('admin', 'auditor', 'security_admin')
  );

-- OUTBOX_ITEMS
DROP POLICY IF EXISTS outbox_tenant_isolation ON public.outbox_items;
CREATE POLICY outbox_tenant_isolation ON public.outbox_items
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- FOLLOW_UP_TASKS
DROP POLICY IF EXISTS followups_tenant_isolation ON public.follow_up_tasks;
CREATE POLICY followups_tenant_isolation ON public.follow_up_tasks
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- SECURE_CONVERSATIONS + SECURE_MESSAGES
DROP POLICY IF EXISTS conversations_tenant_isolation ON public.secure_conversations;
CREATE POLICY conversations_tenant_isolation ON public.secure_conversations
  FOR ALL USING (tenant_id = public.auth_tenant_id());

DROP POLICY IF EXISTS messages_tenant_isolation ON public.secure_messages;
CREATE POLICY messages_tenant_isolation ON public.secure_messages
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- BREAK_GLASS_EVENTS
DROP POLICY IF EXISTS breakglass_tenant_isolation ON public.break_glass_events;
CREATE POLICY breakglass_tenant_isolation ON public.break_glass_events
  FOR ALL USING (tenant_id = public.auth_tenant_id());

-- MEDICATION_CATALOG : lecture pour tous les authentifiés
DROP POLICY IF EXISTS medication_catalog_select ON public.medication_catalog;
CREATE POLICY medication_catalog_select ON public.medication_catalog
  FOR SELECT USING (true);

-- ============================================================
-- 19. SEED TENANT DE PRODUCTION
-- ============================================================
INSERT INTO public.tenants (id, name, status)
VALUES ('00000000-0000-0000-0000-000000000010', 'OneDesk Production', 'active')
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 20. VÉRIFICATION
-- ============================================================
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
BEGIN
  SELECT count(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  RAISE NOTICE 'Schéma créé : % tables, % policies RLS', table_count, policy_count;
END
$$;

-- Fin du script
