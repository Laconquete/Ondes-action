/**
 * ONEDESK CLINIQUE v1.2.0 — Packaging Windows x64
 * --------------------------------------------------
 * Wrapper Node.js autour de @electron/packager.
 * Remplace l'ancienne CLI electron-packager (depreciee).
 *
 * Avantages :
 *   - Pas de dependance a Forge (Forge 8 a supprime `import`,
 *     Forge 7 a des conflits de versions commander/fs-extra).
 *   - Config programmatique plus lisible qu'un long CLI flags.
 *   - Cross-platform : meme script peut generer mac/linux
 *     en changeant `platform` et `arch`.
 *
 * Usage : node scripts/pack-windows.js
 */

const path = require('path');
const fs = require('fs');
const packager = require('@electron/packager');

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'build', 'app');
const OUT_DIR = path.join(ROOT, 'out');

(async () => {
  // Pre-check : le dossier build/app doit exister
  if (!fs.existsSync(path.join(APP_DIR, 'electron', 'main.js'))) {
    console.error('[pack] ERREUR : build/app/electron/main.js introuvable.');
    console.error('       Lancez d\'abord la preparation du dossier Electron (etape 5 du .bat).');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(APP_DIR, 'renderer', 'index.html'))) {
    console.error('[pack] ERREUR : build/app/renderer/index.html introuvable.');
    console.error('       Lancez d\'abord le build Vite (etape 4 du .bat).');
    process.exit(1);
  }

  console.log('[pack] Dossier source :', APP_DIR);
  console.log('[pack] Sortie         :', OUT_DIR);
  console.log('[pack] Plateforme     : win32 / x64');
  console.log('[pack] Version Node   :', process.versions.node);
  console.log('');

  const appPaths = await packager({
    dir: APP_DIR,
    out: OUT_DIR,
    name: 'OneDeskClinique',
    executableName: 'OneDeskClinique',
    platform: 'win32',
    arch: 'x64',
    appVersion: '1.2.3',
    appCopyright: 'Copyright (c) 2026 Fabricefb / MyEventprod',
    productName: 'OneDesk Clinique',
    icon: path.join(ROOT, 'icon.ico'),
    // CRITIQUE (v1.2.3) : asar: false
    // Avec asar: true, Chromium ne peut pas charger file://...app.asar/renderer/index.html
    // → ERR_FILE_NOT_FOUND malgré fs.existsSync() = true.
    // Node.js peut lire dans asar (Electron patche fs), mais Chromium NON.
    // Solution : désactiver asar. Les fichiers restent en clair dans resources/app/.
    // Inconvénient : taille légèrement plus grande (pas de compression asar).
    // Avantage : chargement file:// fonctionne correctement.
    asar: false,
    asarUnpack: [],
    prune: true,
    overwrite: true,
    extraResource: [],
    win32metadata: {
      CompanyName: 'MyEventprod',
      FileDescription: 'OneDesk Clinique — Poste de travail clinique',
      OriginalFilename: 'OneDeskClinique.exe',
      InternalName: 'OneDeskClinique',
      ProductName: 'OneDesk Clinique',
      LegalCopyright: 'Copyright (c) 2026 Fabricefb / MyEventprod',
    },
  });

  console.log('');
  console.log('[pack] OK — packages generes :');
  appPaths.forEach((p) => {
    const exePath = path.join(p, 'OneDeskClinique.exe');
    const exists = fs.existsSync(exePath);
    const sizeMB = exists
      ? (fs.statSync(exePath).size / 1024 / 1024).toFixed(1)
      : '?';
    console.log(`  - ${p} (${sizeMB} Mo${exists ? '' : ' EXE MANQUANT'})`);
  });
  console.log('');
  console.log('[pack] Etape suivante : node scripts/apply-fuses.js');
})().catch((err) => {
  console.error('[pack] ECHEC :', err && err.stack ? err.stack : err);
  process.exit(1);
});
