/**
 * Electron — Preload script (sandboxé)
 * -------------------------------------
 * SEULE surface d'API exposée au renderer via contextBridge.
 *
 * Exposé :
 *   - window.electronAPI.getMachineCode() : Promise<string>  (SHA-256)
 *   - window.electronAPI.app.getVersion()  : string            (synchrone)
 *   - window.electronAPI.app.exit()        : void
 *
 * Rien d'autre. Pas de Node, pas d'ipcRenderer brut, pas de require.
 * Le renderer React accède à ces méthodes via `window.electronAPI`.
 */

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  /**
   * Récupère le code machine (SHA-256 Hardware UUID + MAC).
   * @returns {Promise<string>} Hex SHA-256 (64 caractères majuscules).
   */
  getMachineCode: () => ipcRenderer.invoke('machine-code:get'),

  /**
   * Objet miroir de `app` Electron — version + exit uniquement.
   */
  app: {
    /**
     * Version applicative (lue depuis package.json / Squirrel).
     * @returns {string}
     */
    getVersion: () => ipcRenderer.sendSync('app:get-version'),

    /**
     * Quitte l'application proprement (code 0).
     */
    exit: () => ipcRenderer.send('app:exit'),
  },
});
