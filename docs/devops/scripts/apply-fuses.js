/**
 * ONEDESK CLINIQUE v1.2.0 — Electron Fuses (runtime hardening)
 * ----------------------------------------------------------------
 * Applique les Electron Fuses directement sur le binaire genere
 * par @electron/packager. PAS BESOIN de Forge.
 *
 * Compatible @electron/fuses v2.x (API flipFuses + FuseVersion.V1)
 *
 * Fuses actives :
 *   - EnableNodeCliInspectArguments : false (anti --inspect)
 *   - EnableEmbeddedAsarIntegrityValidation : true (verify app.asar)
 *   - OnlyLoadAppFromAsar : true (force asar)
 *   - LoadBrowserProcessSpecificV8Snapshot : false
 *   - GrantFileProtocolExtraPrivileges : false
 *
 * Reference : https://www.electronjs.org/docs/latest/tutorial/fuses
 */

const path = require('path');
const fs = require('fs');

let fusesMod;
try {
  fusesMod = require('@electron/fuses');
} catch (err) {
  console.warn('[fuses] Module @electron/fuses introuvable :', err.message);
  console.warn('[fuses] Skip — build fonctionnel mais sans hardening runtime.');
  process.exit(0);
}

const { flipFuses, FuseVersion, FuseV1Options } = fusesMod;

if (!flipFuses || !FuseVersion || !FuseV1Options) {
  console.warn('[fuses] API @electron/fuses non reconnue. Version installee :');
  console.warn('[fuses]', require('@electron/fuses/package.json').version);
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
    // v2 API : version = FuseVersion.V1 (pas la version d'Electron)
    // Les fuses sont directement les valeurs booléennes dans l'objet fuseConfig
    await flipFuses(EXE, {
      version: FuseVersion.V1,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
      [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
      [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
      // RunAsNode reste true (sinon casse le mode dev)
      [FuseV1Options.RunAsNode]: true,
      // EnableCookieEncryption reste true (deja par defaut dans Electron)
      [FuseV1Options.EnableCookieEncryption]: true,
    });

    console.log('[fuses] OK — Fuses appliquees sur OneDeskClinique.exe.');
    console.log('[fuses]   - EnableNodeCliInspectArguments      = false');
    console.log('[fuses]   - EnableEmbeddedAsarIntegrity        = true');
    console.log('[fuses]   - OnlyLoadAppFromAsar                = true');
    console.log('[fuses]   - LoadBrowserProcessSpecificV8      = false');
    console.log('[fuses]   - GrantFileProtocolExtraPrivileges   = false');
    console.log('[fuses] Build pret pour distribution.');
  } catch (err) {
    console.error('[fuses] ECHEC :', err && err.stack ? err.stack : err);
    console.error('');
    console.error('[fuses] Le build reste fonctionnel mais SANS hardening runtime.');
    console.error('       Verifiez la version de @electron/fuses (npm ls @electron/fuses).');
    process.exit(2);
  }
})();
