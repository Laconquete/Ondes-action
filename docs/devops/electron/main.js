/**
 * Electron — Main Process OneDesk (NetPhar+ — Poste Clinique)
 * --------------------------------------------------------------
 * Responsabilités :
 *   - Single-instance lock (empêche plusieurs lancements simultanés).
 *   - Création de la BrowserWindow 1440x900 (min 1024x700).
 *   - Menu applicatif (Fichier, Édition, Affichage, Aide).
 *   - Deep-link `netphar://` pour activation de licence.
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
const PROTOCOL = 'netphar';

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
  const raw = `${uuid}|${mac}|netpharplus:v1`;
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
          label: 'À propos de NetPhar+',
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
    title: 'NetPhar+ — Poste Clinique',
    backgroundColor: '#0b0f17',
    show: false,
    autoHideMenuBar: false,
    icon: path.join(__dirname, '..', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: isDev,
      spellcheck: false,
      // On bloque toute navigation externe et toute création de popup
      // non maîtrisée.
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
    win.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'));
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
