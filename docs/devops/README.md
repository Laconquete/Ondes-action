# OneDesk — DevOps (NetPhar+ — Poste Clinique)

Packaging Electron + pipelines CI/CD + portail admin pour l'application
clinique **OneDesk**. Tout est conçu pour un coût d'infrastructure **0 €** en
exploitant les plans gratuits de **Vercel**, **GitHub Actions** et **Supabase**.

## 📁 Arborescence

```
download/devops/
├── forge.config.js              # Config Electron Forge (Squirrel + WiX + hook)
├── package.json                 # Dépendances Electron / Forge (déployées par la CI)
├── icon.ico                     # Icône Windows (placeholder 32×32 RGBA)
├── vercel.json                  # Config Vercel (Vite + CSP + rewrites)
├── electron/
│   ├── main.js                  # Main process (single-instance, deep-link, menu)
│   └── preload.js               # contextBridge (getMachineCode, app.getVersion, app.exit)
├── build/
│   └── installer.iss            # Script Inno Setup (.exe standalone LZMA)
├── .github/workflows/
│   ├── ci.yml                   # CI parallèle (lint + build + test, matrix Node 20/22)
│   └── build-windows.yml        # Release Windows (Squirrel .exe + WiX MSI + Inno Setup)
├── admin/
│   └── index.html               # Portail admin (générateur de licences, single-file)
└── DEPLOYMENT.md                # Guide de déploiement pas à pas (FR)
```

## 🔐 Variables d'environnement

### Côté GitHub (Settings → Secrets and variables → Actions)

| Secret | Usage |
|--------|-------|
| `SUPABASE_URL`          | URL publique du projet Supabase (injectée dans le build Electron) |
| `SUPABASE_ANON_KEY`     | Clé anon Supabase (publique, RLS protège les données) |

### Côté Vercel (Project → Settings → Environment Variables)

| Variable | Scope | Usage |
|----------|-------|-------|
| `VITE_SUPABASE_URL`          | Production / Preview | URL publique Supabase (exposée via `import.meta.env`) |
| `VITE_SUPABASE_ANON_KEY`     | Production / Preview | Clé anon Supabase |

> Ces deux variables sont publiques (préfixe `VITE_`). La sécurité repose sur
> les **Row-Level Security policies** de Supabase, jamais sur la clé anon.

## 🚀 Build local (test)

```bash
# 1. Builder l'app Vite
cd ../../ONDESK && bun install && bun run build && cd ../download/devops

# 2. Installer Electron + Forge
npm install

# 3. Packager Windows (depuis Linux/macOS, résultat non-exécutable mais
#    permet de valider que le hook generateAssets fonctionne)
npx electron-forge make --platform=win32 --arch=x64
```

Pour produire un .exe réellement exécutable sur Windows, lancez la pipeline
via GitHub Actions (push d'un tag `v1.0.0`).

## 📜 Licence

UNLICENSED — usage interne NetPhar+.
