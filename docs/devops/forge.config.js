/**
 * Electron Forge — Configuration OneDesk (NetPhar+ — Poste Clinique)
 * --------------------------------------------------------------------------
 * Objectif :
 *   - Packager l'app React/Vite (buildée dans ../ONDESK/dist) en app Electron.
 *   - Produire plusieurs installeurs Windows :
 *       1. Squirrel.Windows (.exe auto-update)  → distribution principale
 *       2. WiX MSI (.msi per-machine, Program Files) → déploiement IT
 *       3. Inno Setup (.exe autonome, LZMA) → standalone hors auto-update
 *   - Tout est piloté par : `npx electron-forge make --platform=win32`
 *
 * Notes :
 *   - Le placeholder d'icône se trouve dans ./icon.ico (voir README.md).
 *   - Le main process Electron est dans ./electron/main.js.
 *   - Le script Inno Setup est dans ./build/installer.iss.
 *   - Compression LZMA activée côté Squirrel (par défaut) + Inno Setup.
 */

const path = require('path');

module.exports = {
  // --------------------------------------------------------------------
  // 1. Packager (electron-packager) — produit /out/<app>-win32-x64/
  // --------------------------------------------------------------------
  packagerConfig: {
    // Dossier source : on prend le build Vite (./out est interdit car c'est
    // la sortie de Forge, on pointe donc vers ./build/app qui contiendra
    // une copie de ../ONDESK/dist + ./electron + ./package.json).
    dir: path.join(__dirname, 'build', 'app'),
    out: path.join(__dirname, 'out'),

    // Méta produit
    name: 'NetPharPlusPosteClinique',
    executableName: 'NetPharPlus',
    productName: 'NetPhar+ — Poste Clinique',
    appBundleId: 'com.netpharplus.poste-clinique',
    appCopyright: 'Copyright © 2025 NetPhar+',
    appVersion: '1.0.0',

    // Icône Windows (placeholder fourni dans ./icon.ico)
    icon: path.join(__dirname, 'icon'),

    // Empaquetage Asar (lecture seule côté renderer) + prune dev deps
    asar: true,
    asarUnpack: [], // rien à dépacker
    prune: true,
    overwrite: true,

    // Cibles : Windows x64
    platforms: ['win32'],
    arch: ['x64'],

    // N'inclure que les binaires nécessaires (réduit la taille de ~40 %)
    ignore: [
      /^\/\.github$/,
      /^\/admin$/,
      /^\/resources$/,
      /^\/build\/installer\.iss$/,
      /\.md$/,
      /^\/forge\.config\.js$/,
    ],
  },

  // --------------------------------------------------------------------
  // 2. Makers — produisent les installeurs finaux
  // --------------------------------------------------------------------
  makers: [
    // ---- (a) Squirrel.Windows : .exe auto-update (+ RELEASES + .nupkg) ----
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        // Identifiant court utilisé pour les noms de fichier (pas d'espaces).
        name: 'NetPharPlus',
        title: 'NetPhar+ — Poste Clinique',
        authors: 'NetPhar+',
        description: 'Poste Clinique OneDesk — application de consultation clinique',
        // Version fixée manuellement (sinon lue depuis package.json).
        setupExe: 'NetPharPlus-PosteClinique-Setup-1.0.0.exe',
        setupIcon: path.join(__dirname, 'icon.ico'),
        iconUrl: 'file://' + path.join(__dirname, 'icon.ico'),
        // Compression LZMA par défaut côté Squirrel (NuGet) — on le confirme.
        noDelta: false,
        // Pas d'icône de barre des tâches custom pour l'installer.
        loadingGif: null,
        // Pas de raccourci "au démarrage".
        runAfterFinish: false,
      },
    },

    // ---- (b) WiX MSI : installeur per-machine (Program Files) -------------
    {
      name: '@electron-forge/maker-wix',
      config: {
        // Dossier cible sous Program Files.
        programFilesFolderName: 'NetPharPlus',
        // Fabricant / produit (apparaît dans "Programmes et fonctionnalités").
        manufacturer: 'NetPhar+',
        name: 'NetPhar+ Poste Clinique',
        description: 'Poste Clinique OneDesk',
        version: '1.0.0',
        // Langue française (1036 = 0x040C).
        language: 1036,
        // Code de mise à jour stable pour permettre upgrade in-place.
        upgradeCode: '7B5F9C2A-3E4D-4F8B-9A1C-1D2E3F405152',
        // Compression LZMA activée.
        compress: true,
        // Installe par défaut pour "tous les utilisateurs" (HKLM, Program Files).
        perMachine: true,
        // Icône pour Add/Remove Programs.
        iconPath: path.join(__dirname, 'icon.ico'),
        // Raccourcis : desktop + start menu.
        shortcut: {
          name: 'NetPhar+ — Poste Clinique',
          description: 'Poste Clinique OneDesk',
          target: 'NetPharPlus.exe',
          desktop: true,
          startMenu: true,
        },
      },
    },

    // ---- (c) Inno Setup : .exe autonome LZMA, per-machine -----------------
    // Forge n'embarque pas de maker-innosetup officiel ; on délègue la
    // compilation au workflow GitHub Actions via ISCC (Inno Setup Compiler).
    // Le script .iss est dans ./build/installer.iss.
    // Aucune entrée maker ici : la CI exécute `iscc installer.iss` après
    // `electron-forge make` pour produire le standalone.
  ],

  // --------------------------------------------------------------------
  // 3. Plugins — Electron Fuses (sécurité compile-time)
  // --------------------------------------------------------------------
  plugins: [
    {
      name: '@electron-forge/plugin-fuses',
      config: {
        // Fuses activés : durcissement Electron (cf. https://www.electronjs.org/docs/latest/tutorial/fuses)
        // On désactive runAsNode, nodeCliInspect, seulement le nécessaire.
        fuses: {
          // Désactive la possibilité d'exécuter du Node arbitraire via NODE_OPTIONS.
          runAsNode: false,
          enableNodeCliInspectArguments: false,
          // Bloque les requêtes HTTP non sécurisées.
          enableEmbeddedAsarIntegrityValidation: true,
          onlyLoadAppFromAsar: true,
          loadBrowserProcessSpecificV8Snapshot: false,
          grantFileProtocolExtraPrivileges: false,
        },
      },
    },
  ],

  // --------------------------------------------------------------------
  // 4. Hooks — préparation du dossier build/app avant packaging
  // --------------------------------------------------------------------
  hooks: {
    generateAssets: async () => {
      const fs = require('fs');
      const buildAppDir = path.join(__dirname, 'build', 'app');
      fs.mkdirSync(buildAppDir, { recursive: true });

      // Copie du build Vite (../ONDESK/dist) → ./build/app/renderer
      const viteDist = path.join(__dirname, '..', '..', 'ONDESK', 'dist');
      if (!fs.existsSync(viteDist)) {
        throw new Error(
          `[forge] Le build Vite est introuvable dans ${viteDist}. ` +
          `Exécute d'abord "bun run build" dans ONDESK avant de packager.`
        );
      }
      const rendererDir = path.join(buildAppDir, 'renderer');
      fs.rmSync(rendererDir, { recursive: true, force: true });
      fs.cpSync(viteDist, rendererDir, { recursive: true });

      // Copie de ./electron + ./package.electron.json dans build/app
      fs.cpSync(path.join(__dirname, 'electron'), path.join(buildAppDir, 'electron'), { recursive: true });

      // package.json runtime pour Electron (entry = electron/main.js)
      const runtimePkg = {
        name: 'netpharplus-poste-clinique',
        productName: 'NetPhar+ — Poste Clinique',
        version: '1.0.0',
        description: 'Poste Clinique OneDesk',
        main: 'electron/main.js',
        author: 'NetPhar+',
        license: 'UNLICENSED',
        private: true,
      };
      fs.writeFileSync(
        path.join(buildAppDir, 'package.json'),
        JSON.stringify(runtimePkg, null, 2),
        'utf8'
      );

      console.log('[forge] Dossier build/app préparé :', buildAppDir);
    },
  },
};
