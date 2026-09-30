# 🚀 Guide de déploiement — OneDesk (NetPhar+ — Poste Clinique)

Ce guide décrit le déploiement **de bout en bout** de l'application clinique
OneDesk en exploitant **exclusivement des plans gratuits** :
**Vercel** (frontend PWA + portail admin), **GitHub Actions** (build Windows)
et **Supabase** (base de données + auth).

> **Coût total : 0 € / mois** tant que l'on reste dans les quotas des plans
> gratuits. Vérification en fin de document.

---

## 0. Prérequis

| Outil | Version | Rôle |
|-------|---------|------|
| Compte GitHub | — | Hébergement du dépôt + GitHub Actions |
| Compte Vercel | — | Hébergement PWA + portail admin (free tier) |
| Compte Supabase | — | Base Postgres + Auth (free tier) |
| Bun | ≥ 1.1 | Build Vite (recommandé) |
| Node | 20 ou 22 | Requis pour la CI GitHub Actions |

Le dépôt doit contenir :
- `ONDESK/` — la PWA React/Vite
- `download/devops/` — ce dossier (configs Electron + CI/CD + portail admin)

---

## 1. Création du projet Supabase (free tier)

### 1.1 Provisionner le projet

1. Rendez-vous sur [https://supabase.com](https://supabase.com) → **Sign in**.
2. **New project** → nommez-le `netpharplus-prod`, choisissez une région
   proche de vos utilisateurs cliniques (ex: `eu-central-1` pour la France).
3. Mot de passe SQL : générez-en un fort, conservez-le dans un gestionnaire
   de mots de passe.
4. Plan : **Free** (500 MB de DB, 1 GB de fichiers, 50 000 MAU).

### 1.2 Récupérer les identifiants

Dans **Project Settings → API** :

| Variable | Valeur (exemple) | À utiliser comme |
|----------|------|------------------|
| Project URL | `https://xxxxxxxxxxxx.supabase.co` | `SUPABASE_URL` (GitHub) / `VITE_SUPABASE_URL` (Vercel) |
| anon public key | `eyJhbGc...` | `SUPABASE_ANON_KEY` (GitHub) / `VITE_SUPABASE_ANON_KEY` (Vercel) |

> La clé **anon** est publique par design — c'est la **RLS** qui protège les
> données. Ne jamais exposer la clé **service_role** côté client.

### 1.3 Schéma SQL à exécuter

Dans **SQL Editor → New query**, collez et exécute le script suivant :

```sql
-- ============================================================================
-- OneDesk — Schéma clinique (NetPhar+ — Poste Clinique)
-- ============================================================================

-- Extensions
create extension if not exists "pgcrypto";

-- --------------------------------------------------------------------------
-- Table : licences  (registre des licences poste clinique)
-- --------------------------------------------------------------------------
create table if not exists public.licences (
  id            uuid primary key default gen_random_uuid(),
  licence_key   text        not null unique,             -- NPX-XXXX-XXXX-XXXX-XXXX
  tenant_name   text        not null,
  machine_code  text        not null,                     -- SHA-256 (Hardware UUID + MAC)
  plan          text        not null default 'pro'
                check (plan in ('trial', 'pro', 'enterprise')),
  seats         integer     not null default 1,
  status        text        not null default 'active'
                check (status in ('active', 'revoked', 'expired')),
  created_at    timestamptz not null default now(),
  activated_at  timestamptz,
  revoked_at    timestamptz,
  metadata      jsonb       not null default '{}'::jsonb
);

create index if not exists idx_licences_machine_code
  on public.licences (machine_code);
create index if not exists idx_licences_status
  on public.licences (status);

-- --------------------------------------------------------------------------
-- Table : audit_log  (journal des accès, demandes, etc.)
-- --------------------------------------------------------------------------
create table if not exists public.audit_log (
  id          bigserial primary key,
  tenant_id   uuid references public.licences(id) on delete cascade,
  machine_code text,
  event       text not null,                              -- 'app.start', 'licence.activate', etc.
  payload     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists idx_audit_log_created_at
  on public.audit_log (created_at desc);
create index if not exists idx_audit_log_tenant
  on public.audit_log (tenant_id);

-- --------------------------------------------------------------------------
-- Row-Level Security
-- --------------------------------------------------------------------------
alter table public.licences  enable row level security;
alter table public.audit_log enable row level security;

-- Les clients anon ne peuvent lire QUE leur propre licence (par machine_code).
create policy "licences_select_own"
  on public.licences for select
  to anon, authenticated
  using (machine_code = current_setting('app.machine_code', true));

-- Un client anon peut activer une licence (UPDATE activated_at) une seule fois.
create policy "licences_activate_own"
  on public.licences for update
  to anon, authenticated
  using (machine_code = current_setting('app.machine_code', true));

-- Seul le service_role (portail admin) peut insérer / révoquer.
create policy "licences_admin_all"
  on public.licences for all
  to service_role
  using (true) with check (true);

-- Audit log : lecture restreinte au service_role (admin) uniquement.
create policy "audit_admin_all"
  on public.audit_log for all
  to service_role
  using (true) with check (true);

-- Insertion audit log depuis le client (anonyme, mais contraint par schéma).
create policy "audit_insert_anon"
  on public.audit_log for insert
  to anon, authenticated
  with check (true);
```

Cliquez sur **RUN**. Le schéma est prêt.

---

## 2. Configuration des variables d'environnement

### 2.1 GitHub Secrets (build Electron)

Dépôt GitHub → **Settings → Secrets and variables → Actions → New repository secret** :

| Nom | Valeur |
|-----|--------|
| `SUPABASE_URL`          | `https://xxxxxxxxxxxx.supabase.co` |
| `SUPABASE_ANON_KEY`     | `eyJhbGc...` (clé anon publique) |

### 2.2 Vercel Environment Variables (frontend PWA)

Vercel → votre projet `netpharplus-web` → **Settings → Environment Variables** :

| Nom | Value | Environments |
|-----|-------|--------------|
| `VITE_SUPABASE_URL`          | `https://xxxxxxxxxxxx.supabase.co` | Production, Preview |
| `VITE_SUPABASE_ANON_KEY`     | `eyJhbGc...` | Production, Preview |

> ⚠️ **Ne jamais cocher "Sensitive"** pour ces variables : elles doivent être
> accessibles au build time (Vite les inline dans le bundle via
> `import.meta.env`).

---

## 3. Déploiement frontend sur Vercel

### 3.1 Importer le dépôt

1. [https://vercel.com/new](https://vercel.com/new)
2. Importer le dépôt GitHub `mesappfb-maker/ONDESK`.
3. **Root Directory** : `ONDESK` (cliquer sur "Edit" à côté du champ).
4. **Framework Preset** : Vercel détecte automatiquement **Vite**.
5. **Build Command** : `bun run build` (cf. `vercel.json`).
6. **Output Directory** : `dist` (auto).
7. **Install Command** : `bun install --frozen-lockfile`.
8. Déployer. URL : `https://ondesk.vercel.app` (ou similaire).

### 3.2 Configurer le domaine (optionnel)

**Settings → Domains → Add** : ajoutez `app.netpharplus.fr` par exemple.
Vercel génère automatiquement le certificat SSL Let's Encrypt (gratuit).

### 3.3 Vérifier les en-têtes CSP

Une fois déployé, vérifiez les en-têtes avec :

```bash
curl -sI https://ondesk.vercel.app/ | rg -i 'content-security|x-content|x-frame|referrer'
```

Vous devez voir :
- `content-security-policy: default-src 'self'; script-src 'self'; ...`
- `x-content-type-options: nosniff`
- `x-frame-options: DENY`
- `referrer-policy: strict-origin-when-cross-origin`

---

## 4. Déploiement du portail /admin sur Vercel (sous-domaine séparé)

Le portail admin (`download/devops/admin/index.html`) est **statique pur**
(HTML + CSS + JS inline, 0 dépendance). On le déploie comme un projet Vercel
séparé pour isolation de domaine (CSP différente, pas de cookies partagés).

### 4.1 Créer le second projet Vercel

1. Sur Vercel → **Add New → Project** → importer **le même dépôt GitHub**.
2. **Root Directory** : `download/devops` (Edit).
3. **Framework Preset** : **Other** (page statique).
4. **Build Command** : laisser vide (pas de build).
5. **Output Directory** : `admin`.
6. **Install Command** : laisser vide.
7. Déployer.

URL obtenue : `https://netpharplus-admin.vercel.app` (ou votre sous-domaine
personnalisé : `admin.netpharplus.fr`).

### 4.2 Sécuriser en production

Le portail démo protège l'accès par un hash SHA-256 (`netphar-admin-2025`).
Pour la production :

1. **Remplacer l'auth démo** par Supabase Auth (table `auth.users`, emails
   whitelistés via `approved_signups`).
2. **Migrer le stockage** de `localStorage` vers la table Supabase `licences`
   (créée §1.3) avec la clé **service_role** (qui ne doit JAMAIS être exposée
   dans le bundle — appeler Supabase via une **Edge Function**).
3. Activer l'**Email Auth** + **Email confirm** côté Supabase Dashboard.

### 4.3 Flux production (recommandé)

```
[Admin navigateur]
       │ (auth Supabase JWT)
       ▼
[Vercel Edge Function: /api/licences]  ← service_role key (env var Vercel)
       │
       ▼
[Supabase Postgres — table licences (RLS)]
       ▲
       │ (anon key, RLS)
[App Electron OneDesk — active sa licence]
```

---

## 5. Build Windows .exe via GitHub Actions

### 5.1 Structure du workflow

Le fichier `.github/workflows/build-windows.yml` se déclenche sur :

- **push d'un tag** `v*.*.*` (ex: `git tag v1.0.0 && git push --tags`)
- **workflow_dispatch** (lancement manuel depuis l'onglet Actions)

### 5.2 Étapes de la pipeline

1. Checkout du dépôt sur `windows-latest`.
2. Setup Node 22 + Bun + cache npm.
3. Install Inno Setup 6 via `choco`.
4. `bun install` dans `ONDESK/` + `npm install` dans `download/devops/`.
5. `bun run build` (Vite prod, variables Supabase injectées).
6. `npx electron-forge make --platform=win32 --arch=x64`
   → Squirrel `.exe` + WiX `.msi`.
7. `iscc build/installer.iss` → Inno Setup `.exe` standalone LZMA.
8. Upload artifacts (3 fichiers téléchargeables depuis l'onglet Actions).
9. Si trigger = tag : **GitHub Release** créée automatiquement avec le
   `.exe` Squirrel en asset (visible par les clients sur la page Releases).

### 5.3 Lancer un premier build

```bash
# Tag + push
git tag -a v1.0.0 -m "Release initiale NetPhar+ — Poste Clinique"
git push origin v1.0.0

# Suivre : https://github.com/mesappfb-maker/ONDESK/actions
```

Durée attendue : ~6-8 minutes. Sortie typique :

| Artifact | Taille approx. | Usage |
|----------|---------------|-------|
| `NetPharPlus-Squirrel-Setup-exe` | ~95 MB | Installeur principal (auto-update) |
| `NetPharPlus-WiX-msi`           | ~70 MB | Déploiement IT per-machine |
| `NetPharPlus-InnoSetup-Standalone-exe` | ~80 MB | Standalone hors auto-update |

### 5.4 Page Release générée

Une fois le build terminé, GitHub crée automatiquement la release :
`https://github.com/mesappfb-maker/ONDESK/releases/tag/v1.0.0`.

Le client télécharge `NetPharPlus-PosteClinique-Setup-1.0.0.exe`, double-clique,
et suit l'assistant d'installation.

---

## 6. Activation de la licence chez le client (workflow complet)

### 6.1 Côté administrateur (portail admin)

1. Aller sur `https://admin.netpharplus.fr`.
2. Saisir le mot de passe (démo : `netphar-admin-2025`).
3. Cliquer **"Simuler un code machine"** (en démo) — en production, le
   client communique son code machine par téléphone/email sécurisé.
4. Saisir le **nom du tenant** (clinique), le **code machine** du client,
   le plan et le nombre de postes.
5. Cliquer **"Générer la clé"** → une clé `NPX-XXXX-XXXX-XXXX-XXXX` est créée.
6. Transmettre la clé au client par canal sûr.

### 6.2 Côté client (poste clinique Windows)

1. Télécharger le `.exe` depuis la page Release GitHub (ou via le lien fourni).
2. Installer (les raccourcis **Bureau + Start Menu** sont créés automatiquement).
3. Au premier lancement, l'app affiche un écran d'activation :
   - **Code machine** : calculé via `window.electronAPI.getMachineCode()`
     (SHA-256 Hardware UUID + MAC, voir `electron/preload.js`).
   - L'utilisateur transmet ce code à l'admin (par téléphone/email).
4. Une fois la clé reçue, l'utilisateur la saisit dans le champ **Clé de licence**.
5. Au clic **"Activer"** :
   - L'app appelle `https://xxxxxxxx.supabase.co` (clé anon, RLS) ;
   - Supabase vérifie : `licence_key` existe + `machine_code` correspond +
     `status = 'active'` ;
   - Si OK : `activated_at` est positionné, un événement `app.start` est
     écrit dans `audit_log` ;
   - L'app démarre normalement.
6. Pour un **déploiement multi-postes** : refaire le flux pour chaque machine
   (jusqu'à `seats` machines par clé).

### 6.3 Révocation

Côté admin → bouton **"Révoquer"** sur la ligne concernée. En production,
cela positionne `status='revoked'` et `revoked_at=now()` côté Supabase.
Au prochain lancement, l'app détecte la révocation et affiche un écran
bloquant avec contact support.

### 6.4 Deep-link `netphar://`

L'admin peut envoyer au client un lien `netphar://activate/NPX-XXXX-XXXX-XXXX-XXXX`.
Au clic :
1. Windows ouvre l'app Electron (protocole enregistré, cf. `main.js`).
2. Le main process transmet l'URL au renderer via `webContents.send('deep-link', url)`.
3. Le renderer pré-remplit automatiquement le champ **Clé de licence** et
   soumet le formulaire d'activation.

---

## 7. Vérification du coût 0 €

| Service | Quota gratuit | Projection OneDesk |
|---------|---------------|--------------------|
| **Vercel Hobby** | 100 GB bandwidth/mois, 100 GB-h build, domaines illimités, SSL inclus | 1 clinique = ~1 GB/mois → OK |
| **GitHub Actions** | 2 000 minutes/mois (private), illimité (public) | 1 release = ~8 min → 250 releases/mois → OK |
| **GitHub Releases storage** | 2 GB / repo (private), illimité (public) | 3 fichiers × ~80 MB = 240 MB par release → OK si on purge l'historique |
| **Supabase Free** | 500 MB DB, 1 GB storage, 50 000 MAU, 2 GB egress/mois, 2 projets actifs | 1 clinique × 5 postes = ~25 licences + ~10 000 events audit/mois → OK |

**Total : 0 € / mois** pour un déploiement mono-clinique avec 5 postes.

Pour scale au-delà (multi-cliniques) :
- **Vercel Pro** (20 $/mois) — bande passante illimitée, build priority.
- **Supabase Pro** (25 $/mois) — 8 GB DB, 250 GB egress, backups quotidiens.

Soit **45 €/mois** pour passer en mode multi-cliniques sans rupture.

---

## ✅ Checklist de déploiement

- [ ] Projet Supabase créé, schéma SQL exécuté, RLS activée.
- [ ] Secrets GitHub `SUPABASE_URL` + `SUPABASE_ANON_KEY` configurés.
- [ ] Variables Vercel `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` (prod + preview).
- [ ] Projet Vercel `netpharplus-web` déployé (root: `ONDESK`).
- [ ] Projet Vercel `netpharplus-admin` déployé (root: `download/devops`, output: `admin`).
- [ ] Tag `v1.0.0` poussé → pipeline GitHub Actions verte.
- [ ] Release GitHub créée avec le `.exe` en asset.
- [ ] Premier client : code machine récupéré, licence générée dans l'admin, app activée.
- [ ] CSP vérifiée via `curl -sI`.
- [ ] Audit log Supabase alimenté (`select * from audit_log order by created_at desc limit 10;`).

---

## 🧯 Troubleshooting

| Symptôme | Cause | Résolution |
|----------|-------|-----------|
| `Build Vite introuvable` dans la CI | Le dossier `ONDESK/dist` n'existe pas après `bun run build` | Vérifier que `ONDESK/package.json` a `build: vite build`, et que le working directory est `ONDESK/`. |
| `electron-forge make` échoue sur WiX | `wix` non téléchargé ou Windows SDK absent | Re-exécuter ; WiX est installé automatiquement par `@electron-forge/maker-wix` au premier run. |
| `iscc: command not found` | Inno Setup absent du PATH | Le workflow installe via `choco install innosetup` ; en local, [télécharger Inno Setup 6](https://jrsoftware.org/isdl.php) et ajouter au PATH. |
| SmartScreen affiche "Windows a protégé votre ordinateur" | Pas de signature Authenticode (free tier) | Cliquer **"Informations complémentaires" → "Exécuter quand même"**. Pour supprimer l'avertissement, acheter un certificat OV/EV (~200 €/an) et configurer `signtool`. |
| L'app ne s'ouvre pas au clic sur un lien `netphar://` | Protocole non enregistré | Au premier lancement, `app.setAsDefaultProtocolClient('netphar')` est appelé. Si ça échoue (UAC), relancer en tant qu'admin une fois. |
| `getMachineCode()` retourne `unknown-uuid` | PowerShell bloqué par GPO | Contournement : lire `HKLM\SOFTWARE\Microsoft\Cryptography\MachineGuid` (à implémenter dans `electron/main.js` via `regedit` ou `process.env.COMPUTERNAME`). |
| 401 sur les appels Supabase | Clé anon incorrecte ou RLS bloque | Vérifier la variable `VITE_SUPABASE_ANON_KEY`, et la policy `licences_select_own` (le `current_setting('app.machine_code', true)` doit être positionné par l'app via `supabase.rpc(..., { headers: { 'app.machine_code': code } })`). |

---

## 📞 Contacts

- Dépôt : [github.com/mesappfb-maker/ONDESK](https://github.com/mesappfb-maker/ONDESK)
- Issues : [github.com/mesappfb-maker/ONDESK/issues](https://github.com/mesappfb-maker/ONDESK/issues)

---

*Dernière mise à jour : configuration initiale v1.0.0 — OneDesk DevOps pipeline.*
