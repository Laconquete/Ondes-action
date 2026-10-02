/**
 * Electron — Main Process OneDesk Clinique v1.0.0
 * --------------------------------------------------------------
 * Branded : OneDesk Clinique · By Fabricefb / MyEventprod
 * Responsabilités :
 *   - Single-instance lock (empêche plusieurs lancements simultanés).
 *   - Création de la BrowserWindow 1440x900 (min 1024x700).
 *   - Menu applicatif (Fichier, Édition, Affichage, Aide).
 *   - Deep-link `onedesk://` pour activation de licence.
 *   - Chargement du build Vite (file://) en prod, localhost:3000 en dev.
 *   - IPC : getMachineCode (SHA-256 UUID + MAC), getVersion, exit.
 *
 * Sécurité :
 *   - contextIsolation: true
 *   - nodeIntegration: false
 *   - sandbox: true
 *   - DevTools désactivés en production (mais activés en dev).
 */

const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const { execSync } = require('child_process');
const { readFileSync } = require('fs');

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';
const PROTOCOL = 'onedesk';

// ---------------------------------------------------------------------------
// 0. DESACTIVER LE GPU SUR MACHINE VIRTUELLE (anti ecran noir)
// ---------------------------------------------------------------------------
// Symptome : fenetre noire apres lancement (cadre + barre de titre OK mais
// zone principale vide). Cause : Electron/Chromium utilise le GPU pour le
// rendu. Sur une VM (VirtualBox, VMware, Hyper-V, QEMU), le pilote GPU virtuel
// est souvent incompatible avec Chromium → process de rendu crash silencieux.
//
// Solution : detecter les VMs via le fabricant BIOS et desactiver le GPU
// hardware (force le rendu logiciel).
//
// Aussi utile sur de vieux pilotes graphiques (Intel HD 3000/4000) qui
// crashent avec Chromium 132+.
//
// Override manuel : lancer avec ONEDESK_NO_GPU=1 pour forcer le rendu logiciel
// meme sur un PC physique (utile pour debug).
function isVirtualMachine() {
  try {
    const platform = process.platform;
    if (platform === 'win32') {
      const ps = 'powershell -NoProfile -NonInteractive -Command "' +
        'Get-CimInstance Win32_ComputerSystem | Select-Object -ExpandProperty Manufacturer' +
        '"';
      const out = execSync(ps, { encoding: 'utf8', timeout: 5000 }).toLowerCase();
      return ['virtualbox', 'vmware', 'xen', 'qemu', 'microsoft corporation', 'innotek'].some(
        (vm) => out.includes(vm)
      );
    } else if (platform === 'linux') {
      try {
        const sysVendor = readFileSync('/sys/class/dmi/id/sys_vendor', 'utf8').toLowerCase();
        return ['virtualbox', 'vmware', 'xen', 'qemu', 'microsoft'].some((vm) => sysVendor.includes(vm));
      } catch { return false; }
    }
  } catch {
    return false;
  }
  return false;
}

if (isVirtualMachine() || process.env.ONEDESK_NO_GPU === '1') {
  app.disableHardwareAcceleration();
  app.commandLine.appendSwitch('disable-gpu');
  app.commandLine.appendSwitch('disable-software-rasterizer');
  app.commandLine.appendSwitch('in-process-gpu');
  console.log('[main] GPU accel désactivée (machine virtuelle détectée ou ONEDESK_NO_GPU=1).');
} else {
  console.log('[main] GPU accel activée (machine physique).');
}

// ---------------------------------------------------------------------------
// 1. Single-instance lock
// ---------------------------------------------------------------------------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  // Une autre instance tourne déjà : on s'éteint immédiatement.
  app.quit();
  return;
}

app.on('second-instance', (_event, argv) => {
  // Une seconde instance a été lancée : on focus la fenêtre existante
  // et on lui transmet la ligne de commande (peut contenir un deep-link).
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    if (win.isMinimized()) win.restore();
    win.focus();
    handleDeepLink(argv);
  }
});

// ---------------------------------------------------------------------------
// 2. Deep-link `netphar://activate/<license-key>`
// ---------------------------------------------------------------------------
function setAsDefaultProtocolClient() {
  if (process.defaultSSP) return;
  if (!app.isDefaultProtocolClient(PROTOCOL)) {
    app.setAsDefaultProtocolClient(PROTOCOL);
  }
  process.defaultSSP = true;
}

let pendingDeepLink = null;

function handleDeepLink(argv) {
  // Cherche un argument de la forme netphar://...
  const link = argv.find((a) => a.toLowerCase().startsWith(`${PROTOCOL}://`));
  if (!link) return;
  pendingDeepLink = link;
  // Notifie le renderer si la fenêtre est prête.
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('deep-link', link);
  }
}

app.on('open-url', (event, url) => {
  event.preventDefault();
  pendingDeepLink = url;
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send('deep-link', url);
  }
});

// ---------------------------------------------------------------------------
// 3. Calcul du "machine code" (SHA-256 UUID matériel + MAC)
// ---------------------------------------------------------------------------
let cachedMachineCode = null;

function getHardwareUUID() {
  try {
    if (process.platform === 'win32') {
      // PowerShell : UUID SMBIOS (stable, lié à la carte mère).
      const out = execSync(
        'powershell -NoProfile -Command "(Get-CimInstance Win32_ComputerSystemProduct).UUID"',
        { encoding: 'utf8', timeout: 5000 }
      ).trim();
      if (out && /^[0-9A-Fa-f-]{36}$/.test(out)) return out;
    } else if (process.platform === 'darwin') {
      const out = execSync(
        'ioreg -rd1 -c IOPlatformExpertDevice | grep IOPlatformUUID',
        { encoding: 'utf8', timeout: 5000 }
      );
      const m = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (m) return m[1];
    } else if (process.platform === 'linux') {
      try { return readFileSync('/etc/machine-id', 'utf8').trim(); }
      catch { try { return readFileSync('/var/lib/dbus/machine-id', 'utf8').trim(); } catch {} }
    }
  } catch (err) {
    console.error('[main] Échec récupération UUID matériel :', err.message);
  }
  return 'unknown-uuid';
}

function getFirstPhysicalMAC() {
  const ifaces = os.networkInterfaces() || {};
  for (const name of Object.keys(ifaces)) {
    for (const iface of ifaces[name] || []) {
      if (!iface.internal && iface.mac && iface.mac !== '00:00:00:00:00:00') {
        return iface.mac;
      }
    }
  }
  return '00:00:00:00:00:00';
}

function computeMachineCode() {
  if (cachedMachineCode) return cachedMachineCode;
  const uuid = getHardwareUUID();
  const mac = getFirstPhysicalMAC();
  const raw = `${uuid}|${mac}|onedesk:v1`;
  cachedMachineCode = crypto
    .createHash('sha256')
    .update(raw, 'utf8')
    .digest('hex')
    .toUpperCase();
  return cachedMachineCode;
}

// ---------------------------------------------------------------------------
// 4. IPC handlers exposés au preload (sandboxé)
// ---------------------------------------------------------------------------
ipcMain.handle('machine-code:get', () => computeMachineCode());
ipcMain.on('app:get-version', (e) => {
  e.returnValue = app.getVersion();
});
ipcMain.on('app:exit', () => {
  app.exit(0);
});

// ---------------------------------------------------------------------------
// 5. Menu applicatif
// ---------------------------------------------------------------------------
function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Imprimer…',
          accelerator: 'CmdOrCtrl+P',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) w.webContents.print();
          },
        },
        { type: 'separator' },
        {
          label: 'Quitter',
          accelerator: isMac ? 'Cmd+Q' : 'Alt+F4',
          role: 'quit',
        },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Rétablir' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Recharger en forced' },
        { role: 'toggleDevTools', label: 'Outils développeur', visible: isDev },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom 100%' },
        { role: 'zoomIn', label: 'Zoom +' },
        { role: 'zoomOut', label: 'Zoom -' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos de OneDesk Clinique',
          click: () => {
            const w = BrowserWindow.getFocusedWindow();
            if (w) {
              w.webContents.send('show-about');
            }
          },
        },
        {
          label: 'Code machine (licence)',
          click: () => {
            const code = computeMachineCode();
            const w = BrowserWindow.getFocusedWindow();
            if (w) w.webContents.send('show-machine-code', code);
          },
        },
        { type: 'separator' },
        {
          label: 'Documentation en ligne',
          click: () => shell.openExternal('https://github.com/mesappfb-maker/ONDESK'),
        },
        {
          label: 'Signaler un problème',
          click: () => shell.openExternal('https://github.com/mesappfb-maker/ONDESK/issues'),
        },
      ],
    },
  ];
  return Menu.buildFromTemplate(template);
}

// ---------------------------------------------------------------------------
// 6. Création de la fenêtre principale
// ---------------------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'OneDesk Clinique',
    backgroundColor: '#ffffff',
    show: false,
    autoHideMenuBar: false,
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      // DEBUG v1.2.0 : on active DevTools en production pour permettre
      // le diagnostic (touche F12 ou Ctrl+Shift+I pour ouvrir).
      // Une fois le debug terminé, remettre devTools: isDev.
      devTools: true,
      spellcheck: false,
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (pendingDeepLink) {
      win.webContents.send('deep-link', pendingDeepLink);
      pendingDeepLink = null;
    }

    // DEBUG v1.2.0 : Si l'écran reste blanc pendant 4 secondes, on ouvre
    // automatiquement DevTools pour que l'utilisateur voie les erreurs.
    // En production normale (SetupWizard en < 2s), DevTools ne s'ouvre pas.
    let contentLoaded = false;
    win.webContents.once('did-finish-load', () => {
      contentLoaded = true;
    });
    win.webContents.once('dom-ready', () => {
      contentLoaded = true;
    });
    setTimeout(() => {
      if (!contentLoaded && !win.isDestroyed()) {
        console.error('[main] Écran blanc détecté — ouverture automatique de DevTools.');
        win.webContents.openDevTools({ mode: 'detach' });
        // Affiche aussi un message d'erreur dans la console
        win.webContents.executeJavaScript(`
          document.body.innerHTML = '<pre style="padding:20px;font-family:monospace;font-size:14px;color:#dc2626;background:#fef2f2;">' +
            '⚠ ONEDESK — ÉCRAN BLANC DÉTECTÉ\\n\\n' +
            'Le renderer n\\'a pas chargé dans les 4 secondes.\\n' +
            'Causes possibles :\\n' +
            '  1. Chemins absolus /assets/... au lieu de ./assets/...\\n' +
            '  2. Erreur JavaScript dans le bundle\\n' +
            '  3. GPU incompatible avec Chromium 132\\n\\n' +
            'DevTools ouvert — vérifiez la console (onglet Console).\\n' +
            'Pour forcer le rendu logiciel : relancez avec ONEDESK_NO_GPU=1' +
            '</pre>';
        `).catch(() => {});
      }
    }, 4000);
  });

  // Raccourci F12 pour toggler DevTools (utile en production)
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type === 'keyDown') {
      if (input.key === 'F12' ||
          (input.control && input.shift && input.key.toLowerCase() === 'i')) {
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools();
        } else {
          win.webContents.openDevTools({ mode: 'detach' });
        }
        event.preventDefault();
      }
      // Ctrl+R pour recharger le renderer (utile après fix)
      if (input.control && input.key.toLowerCase() === 'r' && !input.shift) {
        win.webContents.reload();
        event.preventDefault();
      }
      // Ctrl+Shift+R pour recharger sans cache
      if (input.control && input.shift && input.key.toLowerCase() === 'r') {
        win.webContents.reloadIgnoringCache();
        event.preventDefault();
      }
    }
  });

  // Ouvre les liens externes (target=_blank) dans le navigateur par défaut.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://') || url.startsWith('mailto:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Empêche toute navigation hors de l'app.
  win.webContents.on('will-navigate', (event, url) => {
    const allowed = isDev
      ? url.startsWith('http://localhost:3000')
      : url.startsWith('file://');
    if (!allowed) event.preventDefault();
  });

  // Charge la source selon l'environnement.
  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Build Vite servi en file:// — le renderer a été copié dans /renderer.
    console.log('[main] Chargement renderer :', path.join(__dirname, '..', 'renderer', 'index.html'));
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
      .then(() => console.log('[main] Renderer chargé OK'))
      .catch((err) => console.error('[main] ERREUR loadFile :', err));
  }
}

// ---------------------------------------------------------------------------
// 7. Cycle de vie app
// ---------------------------------------------------------------------------
app.whenReady().then(() => {
  setAsDefaultProtocolClient();
  Menu.setApplicationMenu(buildMenu());
  createWindow();

  // Sur macOS, recréer une fenêtre quand on clique sur le dock sans fenêtre.
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Rejoue le deep-link passé en ligne de commande au premier lancement.
  handleDeepLink(process.argv);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// Sécurité : on refuse toute création de fenêtre avant le ready.
app.on('web-contents-created', (_event, contents) => {
  contents.on('attach-webview', (e) => e.preventDefault());
});
