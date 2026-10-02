/**
 * ONEDESK CLINIQUE v1.2.0 — Electron Fuses (runtime hardening)
 * ----------------------------------------------------------------
 * Applique les Electron Fuses directement sur le binaire genere
 * par @electron/packager. PAS BESOIN de Forge.
 *
 * Fuses actives (rationale en commentaire) :
 *   - EnableNodeCliInspectArguments : false
 *       Bloque l'injection de code via `--inspect`, `--inspect-brk`, etc.
 *   - EnableEmbeddedAsarIntegrityValidation : true
 *       Au demarrage, Electron verifie que app.asar n'a pas ete modifie.
 *   - OnlyLoadAppFromAsar : true
 *       Interdit de charger l'app depuis un dossier (force asar integre).
 *   - LoadBrowserProcessSpecificV8Snapshot : false
 *       Desactive le chargement d'un snapshot V8 custom (anti-tampering).
 *   - GrantFileProtocolExtraPrivileges : false
 *       Retire les privileges eleves du protocol file://.
 *
 * Fuse NON active :
 *   - RunAsNode : true (laisse par defaut)
 *       Si on le met a false, on ne pourrait plus lancer `electron .` en dev.
 *
 * Reference : https://www.electronjs.org/docs/latest/tutorial/fuses
 */

const path = require('path');
const fs = require('fs');

let fuseNative;
try {
  const fusesMod = require('@electron/fuses');
  fuseNative = fusesMod.flipFuses || fusesMod.default || fusesMod;
} catch (err) {
  console.warn('[fuses] Module @electron/fuses introuvable :', err.message);
  console.warn('[fuses] Skip — build fonctionnel mais sans hardening runtime.');
  process.exit(0);
}

const ROOT = path.join(__dirname, '..');
const APP_DIR = path.join(ROOT, 'out', 'OneDeskClinique-win32-x64');
const EXE = path.join(APP_DIR, 'OneDeskClinique.exe');

(async () => {
  if (!fs.existsSync(EXE)) {
    console.error('[fuses] ERREUR :', EXE, 'introuvable.');
    console.error('        Lancez d\'abord scripts/pack-windows.js.');
    process.exit(1);
  }

  console.log('[fuses] Cible :', EXE);
  console.log('[fuses] Taille :', (fs.statSync(EXE).size / 1024 / 1024).toFixed(1), 'Mo');
  console.log('');

  try {
    await fuseNative(EXE, {
      version: '1.2.0',
      resetAdHocDarwinSignature: false,
      fuseStrings: {},
      fuseWire: {
        EnableNodeCliInspectArguments: false,
        EnableEmbeddedAsarIntegrityValidation: true,
        OnlyLoadAppFromAsar: true,
        LoadBrowserProcessSpecificV8Snapshot: false,
        GrantFileProtocolExtraPrivileges: false,
        RunAsNode: true,
        EnableCookieEncryption: true,
      },
    });
    console.log('[fuses] OK — 5 fuses appliquees sur OneDeskClinique.exe.');
    console.log('[fuses]   - EnableNodeCliInspectArguments  = false');
    console.log('[fuses]   - EnableEmbeddedAsarIntegrity   = true');
    console.log('[fuses]   - OnlyLoadAppFromAsar            = true');
    console.log('[fuses]   - LoadBrowserProcessSpecificV8  = false');
    console.log('[fuses]   - GrantFileProtocolExtraPriv    = false');
    console.log('[fuses] Build pret pour distribution.');
  } catch (err) {
    console.error('[fuses] ECHEC :', err && err.stack ? err.stack : err);
    console.error('');
    console.error('[fuses] Le build reste fonctionnel mais SANS hardening runtime.');
    console.error('       Verifiez la version de @electron/fuses (npm ls @electron/fuses).');
    process.exit(2);
  }
})();
