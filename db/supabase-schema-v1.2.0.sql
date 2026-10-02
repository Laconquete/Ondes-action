-- ============================================================
-- ONEDESK CLINIQUE v1.2.0 — SCHÉMA COMPLET SUPABASE
-- ============================================================
-- À exécuter EN UNE SEULE FOIS dans Supabase Dashboard
--   → SQL Editor → New query → coller ce script → Run
--
-- Ce script est IDEMPOTENT : il peut être rejoué sans casser les données.
-- Il crée :
--   - 16 tables (tenants, users, patients, appointments, etc.)
--   - Les fonctions auth.* (tenant_id, user_role, is_admin, current_user_id)
--   - Le trigger d'auto-création du profil à l'inscription
--   - Les politiques RLS (isolation par tenant + RBAC)
--   - Un tenant de production (UUID fixe 00000000-0000-0000-0000-000000000010)
--   - Un catalogue de médicaments congolais (15 entrées)
--
-- ATTENTION : la création de l'utilisateur ADMIN se fait via le Dashboard
-- Supabase (Authentication > Users > Add user) — voir CONFIG-GUIDE.md.
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
  slug TEXT UNIQUE,
  supabase_project_ref TEXT,
  license_key TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'terminated')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tenants_slug ON public.tenants (slug);

-- ============================================================
-- 2. TABLE USERS (profils cliniques — liés à auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('doctor', 'nurse', 'receptionist', 'auditor', 'security_admin', 'admin')),
  rpps_code TEXT,
  license_number TEXT,
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
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, medical_record_number)
);

CREATE INDEX IF NOT EXISTS idx_patients_tenant ON public.patients (tenant_id);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_name ON public.patients (tenant_id, family_name, given_name);
CREATE INDEX IF NOT EXISTS idx_patients_tenant_status ON public.patients (tenant_id, status);

-- ============================================================
-- 4. TABLE APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  doctor_id UUID REFERENCES public.users(id),
  doctor_name TEXT,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  type TEXT NOT NULL DEFAULT 'consultation' CHECK (type IN ('consultation', 'follow_up', 'emergency', 'teleconsultation', 'procedure', 'surgery')),
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  reason TEXT,
  notes TEXT,
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX IF NOT EXISTS idx_appointments_tenant_patient ON public.appointments (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_doctor_date ON public.appointments (tenant_id, doctor_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_appointments_tenant_status ON public.appointments (tenant_id, status);

-- ============================================================
-- 5. TABLE CLINICAL_NOTES (SOAP)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.users(id),
  author_name TEXT NOT NULL,
  author_role TEXT,
  note_type TEXT NOT NULL DEFAULT 'soap' CHECK (note_type IN ('soap', 'progress', 'discharge', 'procedure', 'consultation', 'emergency')),
  subjective TEXT,
  objective TEXT,
  assessment TEXT,
  plan TEXT,
  note_text TEXT,
  is_signed BOOLEAN NOT NULL DEFAULT FALSE,
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_notes_tenant_patient ON public.clinical_notes (tenant_id, patient_id, created_at);

-- ============================================================
-- 6. TABLE CLINICAL_ADDENDA
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clinical_addenda (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  parent_note_id UUID NOT NULL REFERENCES public.clinical_notes(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.users(id),
  author_name TEXT NOT NULL,
  addendum_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_clinical_addenda_parent ON public.clinical_addenda (parent_note_id);

-- ============================================================
-- 7. TABLE MEDICATION_ORDERS (prescriptions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medication_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  prescriber_id UUID REFERENCES public.users(id),
  prescriber_name TEXT,
  medication_name TEXT NOT NULL,
  atc_code TEXT,
  dosage TEXT NOT NULL CHECK (length(btrim(dosage)) > 0),
  route TEXT,
  frequency TEXT,
  duration TEXT,
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  instructions TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'on_hold')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_medication_orders_tenant_patient ON public.medication_orders (tenant_id, patient_id);

-- ============================================================
-- 8. TABLE MEDICATION_CATALOG (référentiel ATC)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.medication_catalog (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  atc_code TEXT NOT NULL,
  atc_class TEXT,
  form TEXT,
  strength TEXT,
  indications TEXT,
  contraindications TEXT,
  is_controlled BOOLEAN NOT NULL DEFAULT FALSE,
  is_available_cd BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_medication_catalog_atc ON public.medication_catalog (atc_code);

-- ============================================================
-- 9. TABLE AUDIT_EVENTS (INSERT-ONLY, chaîne SHA-256)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  user_name TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  patient_id UUID REFERENCES public.patients(id),
  details JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  previous_hash TEXT,
  event_hash TEXT NOT NULL,
  integrity_chain_seq INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_seq ON public.audit_events (tenant_id, integrity_chain_seq);
CREATE INDEX IF NOT EXISTS idx_audit_events_tenant_created ON public.audit_events (tenant_id, created_at);

-- ============================================================
-- 10. TABLE OUTBOX_ITEMS (queue de sync offline → online)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.outbox_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  idempotency_key TEXT NOT NULL UNIQUE,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  operation TEXT NOT NULL CHECK (operation IN ('INSERT', 'UPDATE', 'DELETE')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON public.outbox_items (tenant_id, status) WHERE status = 'pending';

-- ============================================================
-- 11. TABLE FOLLOW_UP_TASKS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.follow_up_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES public.users(id),
  assigned_to_name TEXT,
  created_by UUID REFERENCES public.users(id),
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  due_date TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_followups_tenant_patient ON public.follow_up_tasks (tenant_id, patient_id);
CREATE INDEX IF NOT EXISTS idx_followups_tenant_assignee ON public.follow_up_tasks (tenant_id, assigned_to, status);

-- ============================================================
-- 12. TABLES SECURE_CONVERSATIONS + SECURE_MESSAGES (messagerie MSSanté)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.secure_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  participants JSONB NOT NULL DEFAULT '[]'::jsonb,
  related_patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'closed', 'archived')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.secure_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  conversation_id UUID NOT NULL REFERENCES public.secure_conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id),
  sender_name TEXT,
  body TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON public.secure_conversations (tenant_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.secure_messages (conversation_id, created_at);

-- ============================================================
-- 13. TABLE BREAK_GLASS_EVENTS (bris de glace urgence)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.break_glass_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id),
  user_name TEXT NOT NULL,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  justification TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  CHECK (expires_at > started_at)
);

CREATE INDEX IF NOT EXISTS idx_breakglass_tenant_user ON public.break_glass_events (tenant_id, user_id, started_at);

-- ============================================================
-- 14. FONCTIONS auth.* (RBAC + tenant isolation via JWT claims)
-- ============================================================
-- Ces fonctions lisent les claims du JWT Supabase Auth pour déterminer
-- le tenant_id et le rôle de l'utilisateur courant.

CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- 1) D'abord, tenter de lire depuis le JWT claim (configuré via Supabase Dashboard > Auth > JWT Settings)
  SELECT COALESCE(
    (current_setting('request.jwt.claims', true)::jsonb->>'tenant_id')::UUID,
    -- 2) Fallback : lire depuis le profil public.users lié à auth.uid()
    (SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    current_setting('request.jwt.claims', true)::jsonb->>'user_role',
    (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
  );
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
-- 15. TRIGGER auto-création profil à l'inscription
-- ============================================================
-- Quand un utilisateur s'inscrit via Supabase Auth (email/password ou Google OAuth),
-- ce trigger crée automatiquement son profil dans public.users avec le rôle 'doctor'
-- par défaut (à changer via Dashboard après activation par l'admin).
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
    FALSE  -- L'utilisateur est inactif jusqu'à activation par l'admin
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
-- 16. IMMUABILITÉ AUDIT_EVENTS (INSERT-ONLY)
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_audit_update()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events est INSERT-ONLY (conformité HDS). Aucune modification autorisée.';
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_audit_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'audit_events est INSERT-ONLY (conformité HDS). Aucune suppression autorisée.';
END;
$$;

DROP TRIGGER IF EXISTS audit_events_no_update ON public.audit_events;
CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_update();

DROP TRIGGER IF EXISTS audit_events_no_delete ON public.audit_events;
CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON public.audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_audit_delete();

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
-- 18. POLITIQUES RLS (isolation par tenant_id + RBAC)
-- ============================================================

-- TENANTS : lecture pour tous les authentifiés (le tenant_id filtre les autres données)
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

-- Seul l'admin peut créer des users dans son tenant
DROP POLICY IF EXISTS users_insert_admin ON public.users;
CREATE POLICY users_insert_admin ON public.users
  FOR INSERT
  WITH CHECK (public.auth_is_admin() AND tenant_id = public.auth_tenant_id());

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

-- AUDIT_EVENTS : INSERT pour tous (chaîne SHA-256), SELECT pour admin/auditor/security_admin
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

-- MEDICATION_CATALOG : lecture pour tous les authentifiés (catalogue partagé)
DROP POLICY IF EXISTS medication_catalog_select ON public.medication_catalog;
CREATE POLICY medication_catalog_select ON public.medication_catalog
  FOR SELECT USING (true);

-- ============================================================
-- 19. SEED TENANT DE PRODUCTION
-- ============================================================
-- UUID FIXE — c'est la valeur à saisir dans le SetupWizard
INSERT INTO public.tenants (id, name, slug, status)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'OneDesk Production',
  'onedesk-production',
  'active'
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  slug = EXCLUDED.slug,
  status = EXCLUDED.status;

-- ============================================================
-- 20. SEED MEDICATION_CATALOG (15 médicaments courants RDC)
-- ============================================================
INSERT INTO public.medication_catalog (name, atc_code, atc_class, form, strength, indications, is_controlled, is_available_cd)
VALUES
  ('Paracétamol', 'N02BE01', 'Analgésiques antipyrétiques', 'Comprimé', '500 mg', 'Douleur, fièvre', FALSE, TRUE),
  ('Ibuprofène', 'M01AE01', 'AINS', 'Comprimé', '400 mg', 'Douleur, inflammation', FALSE, TRUE),
  ('Amoxicilline', 'J01CA04', 'Bêta-lactamines', 'Gélule', '500 mg', 'Infection bactérienne', FALSE, TRUE),
  ('Métronidazole', 'J01XD01', 'Nitro-5 imidazolés', 'Comprimé', '500 mg', 'Infection anaérobie', FALSE, TRUE),
  ('Cotrimoxazole', 'J01EE01', 'Sulfamides antibactériens', 'Comprimé', '800/160 mg', 'Infection urinaire, pneumocystose', FALSE, TRUE),
  ('Artésunate', 'P01BE03', 'Antipaludéens', 'Comprimé', '50 mg', 'Paludisme grave', FALSE, TRUE),
  ('Artéméther-Luméfantrine', 'P01BF02', 'Antipaludéens ACT', 'Comprimé', '20/120 mg', 'Paludisme simple', FALSE, TRUE),
  ('Fer (sulfate)', 'B03AA07', 'Anti-anémiques', 'Comprimé', '200 mg', 'Anémie ferriprive', FALSE, TRUE),
  ('Acide folique', 'B03BB01', 'Anti-anémiques', 'Comprimé', '5 mg', 'Carence folique, grossesse', FALSE, TRUE),
  ('Méthyldopa', 'C02AB01', 'Antihypertenseurs centraux', 'Comprimé', '250 mg', 'HTA gravidique', FALSE, TRUE),
  ('Amlodipine', 'C08CA01', 'Inhibiteurs calciques', 'Comprimé', '5 mg', 'HTA', FALSE, TRUE),
  ('Captopril', 'C09AA01', 'IEC', 'Comprimé', '25 mg', 'HTA, insuffisance cardiaque', FALSE, TRUE),
  ('Furosémide', 'C03CA01', 'Diurétiques de l anse', 'Comprimé', '40 mg', 'Œdème, HTA', FALSE, TRUE),
  ('Insuline NPH', 'A10AC01', 'Insulines', 'Injection', '100 UI/mL', 'Diabète type 1 et 2', FALSE, TRUE),
  ('Méformine', 'A10BA02', 'Biguanides', 'Comprimé', '500 mg', 'Diabète type 2', FALSE, TRUE)
ON CONFLICT (atc_code) DO NOTHING;

-- ============================================================
-- 21. ACTIVATION DE L'ADMIN (À DÉCOMMENTER ET PERSONNALISER)
-- ============================================================
-- APRES avoir créé votre utilisateur admin via Supabase Dashboard
--   (Authentication > Users > Add user > email + password),
--   exécutez ce bloc en remplaçant l'email par le vôtre :
--
-- UPDATE public.users
-- SET
--   tenant_id = '00000000-0000-0000-0000-000000000010',
--   role = 'admin',
--   department = 'Direction Générale',
--   service_code = 'ADMIN',
--   is_active = TRUE
-- WHERE email = 'VOTRE_EMAIL@EXEMPLE.COM';
--
-- Vérifiez avec :
--   SELECT id, email, role, is_active, tenant_id FROM public.users WHERE email = 'VOTRE_EMAIL@EXEMPLE.COM';

-- ============================================================
-- 22. VÉRIFICATION FINALE
-- ============================================================
DO $$
DECLARE
  table_count INTEGER;
  policy_count INTEGER;
  fn_count INTEGER;
  tenant_count INTEGER;
BEGIN
  SELECT count(*) INTO table_count
  FROM information_schema.tables
  WHERE table_schema = 'public' AND table_type = 'BASE TABLE';

  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public';

  SELECT count(*) INTO fn_count
  FROM pg_proc
  WHERE pronamespace = 'public'::regnamespace;

  SELECT count(*) INTO tenant_count FROM public.tenants;

  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  ONEDESK v1.2.0 — Schéma créé avec succès';
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  Tables        : %', table_count;
  RAISE NOTICE '  Politiques RLS: %', policy_count;
  RAISE NOTICE '  Fonctions     : %', fn_count;
  RAISE NOTICE '  Tenants seedés : %', tenant_count;
  RAISE NOTICE '═══════════════════════════════════════════════';
  RAISE NOTICE '  PROCHAINE ÉTAPE :';
  RAISE NOTICE '  1. Créez l''admin via Supabase Dashboard > Authentication > Users';
  RAISE NOTICE '  2. Activez-le via le bloc SQL section 21 (décommentez et adaptez)';
  RAISE NOTICE '  3. Dans l''app SetupWizard, saisissez :';
  RAISE NOTICE '     - Supabase URL: https://VOTRE_PROJET.supabase.co';
  RAISE NOTICE '     - Anon Key   : (Dashboard > Settings > API)';
  RAISE NOTICE '     - Tenant UUID : 00000000-0000-0000-0000-000000000010';
  RAISE NOTICE '═══════════════════════════════════════════════';
END
$$;

-- Fin du script.
