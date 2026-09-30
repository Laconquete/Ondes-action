-- ============================================================
-- MIGRATION : Intégration Supabase Auth native
-- ============================================================
--
-- Problème résolu :
--   Le schéma initial utilisait des fonctions auth.tenant_id() et auth.user_role()
--   qui lisaient des claims JWT personnalisés (injection header). C'était FALSFIFIABLE :
--   un attaquant avec l'anon key pouvait forger un JWT avec n'importe quel tenant_id.
--
-- Solution :
--   1. Ajouter la colonne `auth_user_id UUID REFERENCES auth.users(id)` à `public.users`
--   2. Mettre à jour les fonctions pour faire un lookup : `auth.uid()` → `users.auth_user_id` → `tenant_id` / `role`
--   3. `auth.uid()` est la fonction NATIVE de Supabase — elle renvoie l'UUID de l'utilisateur
--      authentifié via Supabase Auth (signInWithPassword). IMPOSSIBLE à forger sans credentials.
--
-- Architecture finale :
--   - Utilisateur créé dans : auth.users (Supabase Auth, mot de passe hashé bcrypt serveur)
--   - Profil clinique dans : public.users (tenant_id, role, display_name, rpps_code)
--   - Lien : public.users.auth_user_id = auth.users.id
--   - RLS : toutes les policies utilisent auth.uid() → lookup public.users → filtrage tenant_id
--
-- Flow de création d'un utilisateur :
--   1. Admin crée l'utilisateur dans Supabase Dashboard → Auth → Users → Add user
--   2. Admin exécute : INSERT INTO public.users (auth_user_id, tenant_id, role, ...) VALUES (...)
--   3. L'utilisateur se connecte avec email + password via l'app
--   4. L'app récupère son profil via SELECT * FROM users WHERE auth_user_id = auth.uid()
-- ============================================================

-- ============================================================
-- 1. AJOUT DE LA COLONNE auth_user_id
-- ============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Index pour le lookup rapide auth_user_id → profil
CREATE INDEX IF NOT EXISTS idx_users_auth_user_id ON public.users (auth_user_id);

-- Contrainte d'unicité : un user Auth = un seul profil clinique
ALTER TABLE public.users
  ADD CONSTRAINT uq_users_auth_user_id UNIQUE (auth_user_id);

COMMENT ON COLUMN public.users.auth_user_id IS 'UUID de l''utilisateur dans auth.users (Supabase Auth). NULL pour les utilisateurs en mode offline-only (demo/local).';


-- ============================================================
-- 2. MISE À JOUR DES FONCTIONS D'AUTHENTIFICATION
-- ============================================================
-- Les anciennes fonctions lisaient des claims JWT personnalisés (insecure).
-- Les nouvelles font un lookup dans public.users via auth.uid() (native, sécurisé).

CREATE OR REPLACE FUNCTION public.auth_tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Récupère le tenant_id de l'utilisateur authentifié via Supabase Auth.
  -- auth.uid() retourne l'UUID de l'utilisateur dans auth.users.
  -- On cherche la ligne correspondante dans public.users.
  --
  -- Sécurité :
  --   - auth.uid() est IMPOSSIBLE à forger (validé par Supabase)
  --   - SECURITY DEFINER + STABLE : la fonction s'exécute avec les droits du propriétaire
  --     (postgres) et peut lire public.users même si RLS bloque l'utilisateur direct
  --   - search_path = public : prévient l'attaque par search path injection
  SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Récupère le rôle de l'utilisateur authentifié.
  -- Utilisé par les policies RLS pour vérifier les permissions (RBAC).
  SELECT role::TEXT FROM public.users WHERE auth_user_id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.auth_current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  -- Récupère l'UUID du profil clinique (public.users.id) de l'utilisateur authentifié.
  -- Différent de auth.uid() qui retourne l'UUID Auth.
  SELECT id FROM public.users WHERE auth_user_id = auth.uid();
$$;

-- Remplacer les anciennes fonctions auth.tenant_id() etc. par des wrappers
-- qui délèguent aux nouvelles (rétro-compatibilité pour le schéma existant)
CREATE OR REPLACE FUNCTION auth.tenant_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.auth_tenant_id();
$$;

CREATE OR REPLACE FUNCTION auth.user_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.auth_user_role();
$$;

CREATE OR REPLACE FUNCTION auth.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.auth_user_role() IN ('admin', 'security_admin');
$$;

CREATE OR REPLACE FUNCTION auth.current_user_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT public.auth_current_user_id();
$$;

COMMENT ON FUNCTION auth.tenant_id() IS 'Récupère le tenant_id de l''utilisateur authentifié via Supabase Auth (auth.uid()). Lookup dans public.users. SÉCURISÉ — impossible à forger sans credentials.';


-- ============================================================
-- 3. MISE À JOUR DES POLITIQUES RLS
-- ============================================================
-- Les policies existantes utilisent déjà auth.tenant_id() et auth.user_role().
-- Avec les nouvelles fonctions sécurisées, elles fonctionnent automatiquement.
-- Mais on ajoute une policy supplémentaire : un utilisateur ne peut lire QUE
-- son propre profil dans public.users (pas les autres utilisateurs du même tenant).

DROP POLICY IF EXISTS users_select_own_profile ON public.users;
CREATE POLICY users_select_own_profile ON public.users
  FOR SELECT
  USING (
    -- L'utilisateur peut voir son propre profil (via auth_user_id = auth.uid())
    auth_user_id = auth.uid()
    -- OU l'admin/security_admin peut voir tous les profils de son tenant
    OR (auth.is_admin() AND tenant_id = auth.tenant_id())
  );

DROP POLICY IF EXISTS users_update_own_profile ON public.users;
CREATE POLICY users_update_own_profile ON public.users
  FOR UPDATE
  USING (
    -- Un utilisateur peut mettre à jour son propre profil (display_name, avatar, etc.)
    -- MAIS PAS son rôle ou son tenant_id (réservé à l'admin)
    auth_user_id = auth.uid()
  )
  WITH CHECK (
    -- Le CHECK empêche l'escalade de privilèges : on ne peut pas changer son rôle ou tenant
    auth_user_id = auth.uid()
    AND role = (SELECT role FROM public.users WHERE auth_user_id = auth.uid())
    AND tenant_id = (SELECT tenant_id FROM public.users WHERE auth_user_id = auth.uid())
  );

COMMENT ON POLICY users_update_own_profile ON public.users IS 'Un utilisateur peut modifier son profil (displayName, avatarUrl) mais PAS son rôle ou tenant_id (anti-escalade).';


-- ============================================================
-- 4. TRIGGER : auto-création du profil à l'inscription
-- ============================================================
-- Quand un nouvel utilisateur s'inscrit via Supabase Auth, on crée automatiquement
-- une ligne dans public.users avec un tenant_id par défaut et le rôle 'doctor'.
-- L'admin pourra ensuite modifier le rôle et le tenant_id si nécessaire.

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Crée un profil par défaut pour les nouveaux utilisateurs Supabase Auth.
  -- tenant_id NULL : l'utilisateur n'a pas encore de tenant assigné (admin doit le configurer).
  -- role 'doctor' : rôle par défaut, l'admin peut le changer.
  -- isActive = false : l'utilisateur doit être activé par l'admin avant de pouvoir utiliser l'app.
  INSERT INTO public.users (
    id,
    auth_user_id,
    tenant_id,
    email,
    username,
    display_name,
    role,
    department,
    service_code,
    is_active,
    created_at
  ) VALUES (
    gen_random_uuid(),
    NEW.id,
    NULL, -- Pas de tenant par défaut — l'admin doit l'assigner
    NEW.email,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'doctor', -- Rôle par défaut
    'À confirmer',
    'PENDING',
    FALSE, -- Inactif jusqu'à validation admin
    NOW()
  )
  ON CONFLICT (auth_user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Attacher le trigger sur auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_auth_user();

COMMENT ON FUNCTION public.handle_new_auth_user() IS 'Trigger : auto-crée un profil dans public.users quand un utilisateur s''inscrit via Supabase Auth. Rôle par défaut : doctor, inactif, sans tenant — l''admin doit valider.';


-- ============================================================
-- 5. SEED : utilisateur admin de production
-- ============================================================
-- À exécuter APRÈS avoir créé l'utilisateur admin dans Supabase Dashboard.
-- Remplacez 'ADMIN_AUTH_USER_ID' par l'UUID réel de l'utilisateur créé.

DO $$
BEGIN
  -- Crée un tenant de production si inexistant
  IF NOT EXISTS (SELECT 1 FROM public.tenants WHERE id = '00000000-0000-0000-0000-000000000010') THEN
    INSERT INTO public.tenants (id, name, supabase_project_ref, license_key, status, created_at)
    VALUES (
      '00000000-0000-0000-0000-000000000010',
      'OneDesk Production',
      NULL,
      NULL,
      'active',
      NOW()
    );
  END IF;

  -- NOTE : Pour lier un utilisateur admin, exécutez après l'avoir créé dans Supabase Dashboard :
  --
  -- UPDATE public.users
  -- SET
  --   tenant_id = '00000000-0000-0000-0000-000000000010',
  --   role = 'admin',
  --   is_active = TRUE,
  --   department = 'Administration',
  --   service_code = 'ADMIN'
  -- WHERE auth_user_id = 'UUID-DE-LADMIN-DANS-SUPABASE-AUTH';

  RAISE NOTICE 'Tenant de production créé. Exécutez le UPDATE ci-dessus pour lier votre utilisateur admin.';
END
$$;


-- ============================================================
-- 6. VÉRIFICATION
-- ============================================================

-- Test : les fonctions retournent NULL quand non authentifié
SELECT 'auth.tenant_id() non auth' AS test, auth.tenant_id() IS NULL AS expected;
SELECT 'auth.user_role() non auth' AS test, auth.user_role() IS NULL AS expected;

-- Test : la colonne auth_user_id existe
SELECT 'auth_user_id column exists' AS test,
       EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
         AND table_name = 'users'
         AND column_name = 'auth_user_id'
       ) AS expected;

-- Fin de la migration
