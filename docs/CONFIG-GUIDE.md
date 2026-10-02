# Guide de Configuration — OneDesk Clinique v1.2.0

**Procédure complète pas-à-pas** : depuis un compte Supabase vierge jusqu'au premier login dans l'application Windows.

---

## Vue d'ensemble

Le flux de mise en service est le suivant :

```
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ 1. Supabase         │ →  │ 2. SQL schema       │ →  │ 3. Créer admin      │
│ créer projet        │    │ exécuter script     │    │ via Dashboard       │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
                                                                ↓
┌─────────────────────┐    ┌─────────────────────┐    ┌─────────────────────┐
│ 6. Login & utilisation│ ← │ 5. SetupWizard      │ ← │ 4. Lancer le .exe   │
│ dans OneDesk        │    │ saisir les 5 valeurs│    │ sur Windows         │
└─────────────────────┘    └─────────────────────┘    └─────────────────────┘
```

**Durée totale** : ~15 minutes.

---

## Étape 1 — Créer un projet Supabase (gratuit)

1. Allez sur https://supabase.com/dashboard
2. Cliquez **New project**
3. Remplissez :
   - **Name** : `OneDesk Production` (ou votre nom de clinique)
   - **Database Password** : générez un mot de passe fort, **notez-le** dans un gestionnaire de mots de passe (Bitwarden, 1Password)
   - **Region** : `Frankfurt` (eu-central-1) — le plus proche de l'Afrique centrale avec faible latence
   - **Pricing Plan** : **Free** (suffisant pour 500 MB de données + 50k utilisateurs actifs/mois)
4. Cliquez **Create new project**
5. **Attendez 2-3 minutes** que le projet soit provisionné (status `Active`)

---

## Étape 2 — Exécuter le schéma SQL

1. Dans Supabase Dashboard, allez dans **SQL Editor** (icône `>` dans la sidebar gauche)
2. Cliquez **New query**
3. Ouvrez le fichier `db/supabase-schema-v1.2.0.sql` (livré avec l'app)
4. **Copiez-collez tout le contenu** dans l'éditeur SQL
5. Cliquez **Run** (bouton vert en bas)
6. Attendez l'exécution (~10 secondes)
7. Vérifiez dans l'onglet **Messages** en bas que vous voyez :
   ```
   ONEDESK v1.2.0 — Schéma créé avec succès
   Tables        : 14
   Politiques RLS: 17
   Fonctions     : 7
   Tenants seedés : 1
   ```

**Que vient de créer ce script ?**
- 14 tables : `tenants`, `users`, `patients`, `appointments`, `clinical_notes`, `medication_orders`, `audit_events`, `outbox_items`, etc.
- 7 fonctions PostgreSQL : `auth_tenant_id()`, `auth_user_role()`, `auth_is_admin()`, `auth_current_user_id()`, `handle_new_auth_user()`, `prevent_audit_update()`, `prevent_audit_delete()`
- 3 triggers : `on_auth_user_created` (auto-création du profil), `audit_events_no_update`, `audit_events_no_delete`
- 17 politiques RLS : isolation par `tenant_id` + RBAC (réceptionnistes exclus des notes cliniques, audit en INSERT-ONLY)
- 1 tenant seed : `00000000-0000-0000-0000-000000000010` (nom `OneDesk Production`)
- 15 médicaments congolais pré-chargés (Paracétamol, Amoxicilline, Artéméther-Luméfantrine, etc.)

---

## Étape 3 — Créer l'utilisateur Admin

L'admin doit être créé via le Dashboard Supabase (pas via SQL) car son mot de passe doit être hashé par Supabase Auth.

1. Dans Supabase Dashboard, allez dans **Authentication** (icône bouclier)
2. Onglet **Users** → bouton **Add user**
3. Remplissez :
   - **Email** : `fabricefb@myeventprod.com` (ou votre email)
   - **Password** : un mot de passe fort (min 12 caractères)
   - **Auto Confirm User** : ✅ coché (sinon l'utilisateur devra confirmer par email)
4. Cliquez **Create user**

**Le trigger `on_auth_user_created` va automatiquement** :
- Créer une ligne dans `public.users` avec `role='doctor'` (par défaut)
- `is_active = false` (en attente d'activation admin — mais comme c'est le 1ʳᵉ utilisateur, on doit l'activer manuellement via SQL)

### Activer l'admin via SQL

Retournez dans **SQL Editor** → **New query** → collez ce script en remplaçant l'email par le vôtre :

```sql
-- ACTIVE L'ADMIN : lui attribue le rôle 'admin', le tenant de production,
-- et active son compte (is_active = true)

UPDATE public.users
SET
  tenant_id = '00000000-0000-0000-0000-000000000010',
  role = 'admin',
  department = 'Direction Générale',
  service_code = 'ADMIN',
  is_active = TRUE,
  updated_at = NOW()
WHERE email = 'fabricefb@myeventprod.com';  -- ⚠ REMPLACEZ par votre email

-- Vérification
SELECT id, email, role, is_active, tenant_id, display_name
FROM public.users
WHERE email = 'fabricefb@myeventprod.com';  -- ⚠ IDEM
```

Cliquez **Run**. Vous devriez voir une ligne s'afficher avec :
- `role = admin`
- `is_active = true`
- `tenant_id = 00000000-0000-0000-0000-000000000010`

---

## Étape 4 — Récupérer les valeurs Supabase pour le SetupWizard

### 4.1 — Supabase URL

1. Dans Supabase Dashboard, allez dans **Project Settings** (icône engrenage en bas à gauche)
2. Onglet **API**
3. **Project URL** : copiez la valeur (ressemble à `https://abcdefghijklm.supabase.co`)

### 4.2 — Supabase Anon Key

Dans la même page **API** :
1. Sous **Project API keys**
2. Copiez la valeur `anon` `public` (commence par `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`)
3. ⚠ **NE PAS** copier la clé `service_role` — celle-ci est secrète et ne doit jamais être dans l'app

### 4.3 — Google OAuth Client ID (optionnel)

Si vous voulez activer le bouton « Continuer avec Google » :

1. Allez sur https://console.cloud.google.com
2. Créez un projet ou sélectionnez un projet existant
3. **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth client ID**
4. Type : **Web application**
5. Name : `OneDesk Clinique`
6. **Authorized JavaScript origins** :
   - `https://abcdefghijklm.supabase.co` (remplacez par votre URL Supabase)
   - `http://localhost:3000` (pour le dev local)
7. **Authorized redirect URIs** :
   - `https://abcdefghijklm.supabase.co/auth/v1/callback`
8. Cliquez **Create**
9. Copiez le **Client ID** (format `123456789-xxx.apps.googleusercontent.com`)
10. Dans Supabase Dashboard → **Authentication** → **Providers** → **Google** :
    - Activez Google
    - Collez le Client ID et le Client Secret
    - Sauvegardez

### 4.4 — Vercel Admin URL (optionnel)

Si vous avez déployé le portail admin (séparément) sur Vercel, copiez son URL. Sinon laissez vide.

### 4.5 — Tenant UUID

C'est l'UUID du tenant créé par le seed SQL :

```
00000000-0000-0000-0000-000000000010
```

(Pour vérifier : Dashboard → Table Editor → `tenants` → colonne `id`)

---

## Étape 5 — Lancer OneDesk et configurer

1. Double-clic sur `OneDeskClinique.exe`
2. Au 1ᵉʳ lancement, l'écran **SetupWizard** apparaît (3 étapes)

### Étape 1/3 du wizard — Backend Supabase

| Champ | Valeur à saisir | Exemple |
|---|---|---|
| URL Supabase | Project URL de Supabase | `https://abcdefghijklm.supabase.co` |
| Anon Key (publique) | Clé `anon` `public` | `eyJhbGciOiJIUzI1NiIs...` |

Cliquez **Tester la connexion** → doit afficher **« Connexion réussie · Latence : 120 ms »** (ou similaire)

Cliquez **Continuer**

### Étape 2/3 du wizard — Google OAuth (optionnel)

| Champ | Valeur à saisir | Si non configuré |
|---|---|---|
| Google OAuth Client ID | Le client ID Google Cloud | Laissez vide — Google OAuth sera désactivé, l'auth locale PBKDF2 reste fonctionnelle |
| URL Vercel (portail admin) | URL du portail admin si déployé | Laissez vide |

Cliquez **Continuer**

### Étape 3/3 du wizard — Identité de l'établissement

| Champ | Valeur à saisir | Exemple |
|---|---|---|
| Nom de l'établissement | Nom lisible | `Clinique Saint-Luc de Kinshasa` |
| Identifiant du tenant (UUID) | UUID du seed SQL | `00000000-0000-0000-0000-000000000010` |

Cliquez **Sauvegarder & démarrer**

La configuration est **chiffrée AES-GCM 256** et stockée en localStorage (clé dérivée du code machine + numéro de licence).

---

## Étape 6 — Premier login

Après sauvegarde, l'écran de login apparaît.

1. Saisissez votre **email** (celui créé en étape 3, ex. `fabricefb@myeventprod.com`)
2. Saisissez votre **mot de passe** (celui choisi en étape 3)
3. Cliquez **Se connecter**

Si tout est configuré correctement :
- L'auth Supabase Auth valide les identifiants → renvoie un JWT
- Le profil `public.users` est lu (RLS autorise car `tenant_id` correspond)
- L'app démarre, le syncWorker commence à tirer les données Supabase → IndexedDB local
- Vous voyez le tableau de bord avec les onglets selon votre rôle (`admin` = tous les onglets)

---

## Récapitulatif des valeurs à saisir

| # | Champ | Où la trouver | Valeur par défaut |
|---:|---|---|---|
| 1 | Supabase URL | Dashboard → Project Settings → API | `https://VOTRE_PROJET.supabase.co` |
| 2 | Supabase Anon Key | Dashboard → Project Settings → API → `anon public` | `eyJhbGciOiJIUzI1NiIs...` (160+ caractères) |
| 3 | Google OAuth Client ID | Google Cloud Console → Credentials | (optionnel — laisser vide pour désactiver) |
| 4 | Vercel Admin URL | Votre déploiement Vercel | (optionnel — laisser vide) |
| 5 | Nom du tenant | Au choix (nom de votre clinique) | `OneDesk Production` |
| 6 | UUID du tenant | Seed SQL | `00000000-0000-0000-0000-000000000010` |
| 7 | Email admin | Celui créé en étape 3 | `fabricefb@myeventprod.com` |
| 8 | Mot de passe admin | Celui choisi en étape 3 | (min 12 caractères) |

---

## Vérifications post-installation

### Test 1 : Connexion Supabase OK
Dans le SetupWizard, étape 1, cliquez **Tester la connexion** → doit afficher « Connexion réussie ».

### Test 2 : Login admin OK
Après setup, login avec email + password → vous voyez le dashboard avec tous les onglets.

### Test 3 : Isolation RLS
Dans Supabase Dashboard → Table Editor → `patients` → vous ne voyez AUCUNE donnée (car RLS filtre par tenant_id et le Dashboard n'a pas de JWT utilisateur). C'est normal — ça prouve que RLS fonctionne.

### Test 4 : Audit immuable
Dans Supabase SQL Editor, essayez :
```sql
UPDATE public.audit_events SET user_name = 'hacker' WHERE id = (
  SELECT id FROM public.audit_events LIMIT 1
);
```
Doit retourner l'erreur : `audit_events est INSERT-ONLY (conformité HDS). Aucune modification autorisée.`

### Test 5 : Wipe IndexedDB au logout
1. Connectez-vous en admin → créez un patient
2. Déconnectez-vous (menu Avatar → Déconnexion)
3. Reconnectez-vous avec le même compte → le patient créé a disparu de l'IndexedDB local (mais reste dans Supabase → sera re-syncé au prochain pull)

---

## Troubleshooting

### « Échec de connexion » dans SetupWizard
- Vérifiez que l'URL commence par `https://` et finit par `.supabase.co`
- Vérifiez que l'anon key est la clé `anon public`, PAS `service_role`
- Vérifiez que vous avez bien exécuté le SQL (table `tenants` doit exister)

### « Identifiants Supabase invalides » dans LoginScreen
- Vérifiez que l'utilisateur existe dans Supabase Dashboard → Authentication → Users
- Vérifiez que `is_active = true` dans la table `public.users` (sinon exécutez le SQL d'activation de l'étape 3)
- Vérifiez que l'utilisateur a `tenant_id = 00000000-0000-0000-0000-000000000010`

### Écran blanc après SetupWizard
- Ouvrez la console DevTools (Ctrl+Shift+I — activé en dev, désactivé en prod)
- Ou lancez l'app depuis un terminal : `OneDeskClinique.exe` dans un cmd → les logs du main process s'affichent
- Vérifiez qu'il n'y a pas d'erreur dans la console du renderer (forwardée par `console-message`)

### Google OAuth ne marche pas
- Vérifiez que vous avez activé Google dans Supabase Dashboard → Authentication → Providers
- Vérifiez que les URLs de redirection dans Google Cloud Console incluent `https://VOTRE_PROJET.supabase.co/auth/v1/callback`
- Google OAuth nécessite une connexion internet — en mode offline, utilisez l'auth locale (email + password)

### « Tenant introuvable »
- Vérifiez dans Supabase Dashboard → Table Editor → `tenants` qu'il y a bien une ligne avec `id = 00000000-0000-0000-0000-000000000010`
- Si vous avez supprimé le tenant par erreur, relancez le script SQL (il est idempotent)

---

## Prochaines étapes

Une fois l'app configurée et l'admin connecté :

1. **Créer les autres utilisateurs** : via le bouton « Gestion des utilisateurs » dans le menu Avatar (rôle admin requis) — permet de créer médecins, infirmières, réceptionnistes
2. **Créer le 1ᵉʳ patient** : onglet Patients → bouton « Nouveau patient »
3. **Activer une licence** (optionnel) : si vous distribuez l'app à d'autres cliniques, générez des clés de licence via le portail admin `/admin` et activez-les dans l'app via `onedesk://activate/NPX-XXXX-XXXX-XXXX-XXXX`

---

## Support

- **WhatsApp** : +243 999 071 754 (Fabricefb / MyEventprod)
- **Email** : fabricefb@myeventprod.com
- **Repo GitHub** : https://github.com/Laconquete/Ondes-action (privé)

---

## Révoquer le PAT GitHub

Si vous avez utilisé un Personal Access Token pour pousser le code vers `Laconquete/Ondes-action` (token commençant par `ghp_`), **révoquez-le immédiatement** après la 1ʳᵉ release :

1. https://github.com/settings/tokens
2. Trouvez le token utilisé
3. Cliquez **Delete** ou **Regenerate**

Ensuite, pour les pushes futurs, utilisez soit :
- Un nouveau PAT à usage unique
- GitHub CLI (`gh auth login`) avec authentification browser
- Une deploy key dédiée au repo

---

*Document généré pour OneDesk Clinique v1.2.0 — Fabricefb / MyEventprod · +243 999 071 754*
