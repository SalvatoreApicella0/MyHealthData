import { app, clipboard, Menu, Tray, dialog, nativeImage, safeStorage, shell } from 'electron';
import Bonjour from 'bonjour-service';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = path.dirname(fileURLToPath(import.meta.url));
const port = Number(process.env.MHD_HUB_PORT || 8472);
const syncPort = Number(process.env.MHD_HUB_SYNC_PORT || 8473);
const address = `http://127.0.0.1:${port}`;
const italian = String(app.getLocale() || '').toLowerCase().startsWith('it');
const copy = italian ? {
  appName: 'MyHealthData Hub',
  running: '● Hub attivo', runningDevices: (count) => `● Hub attivo · ${count} ${count === 1 ? 'dispositivo' : 'dispositivi'}`,
  offline: '● Hub non disponibile', restarting: '● Riavvio del Hub…',
  launch: 'Apri MyHealthData', connect: 'Connetti un dispositivo…', copyAddress: 'Copia indirizzo locale',
  restart: 'Riavvia Hub', startAtLogin: 'Avvia al login', about: 'Informazioni su MyHealthData Hub', quit: 'Esci',
  bootError: 'MyHealthData Hub non è riuscito ad avviarsi.', unknownError: 'Errore sconosciuto',
  tooltip: 'MyHealthData Hub', tooltipDevices: (count) => `MyHealthData Hub — ${count} ${count === 1 ? 'dispositivo' : 'dispositivi'}`,
} : {
  appName: 'MyHealthData Hub',
  running: '● Hub running', runningDevices: (count) => `● Hub running · ${count} device${count === 1 ? '' : 's'}`,
  offline: '● Hub unavailable', restarting: '● Restarting Hub…',
  launch: 'Open MyHealthData', connect: 'Connect a device…', copyAddress: 'Copy local address',
  restart: 'Restart Hub', startAtLogin: 'Start at login', about: 'About MyHealthData Hub', quit: 'Quit',
  bootError: 'MyHealthData Hub could not start.', unknownError: 'Unknown error',
  tooltip: 'MyHealthData Hub', tooltipDevices: (count) => `MyHealthData Hub — ${count} device${count === 1 ? '' : 's'}`,
};
let tray;
let hub;
let bonjour;
let hubAdvertisement;
let quitting = false;
let hubRestarts = 0;
let restarting = false;
let state = { running: false, deviceCount: 0 };

function hubStatus() {
  return new Promise((resolve) => {
    const request = http.get(`${address}/healthz`, (response) => {
      if (response.statusCode !== 200) { response.resume(); resolve(null); return; }
      let body = ''; response.setEncoding('utf8'); response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => { try { resolve(JSON.parse(body)); } catch { resolve(null); } });
    });
    request.once('error', () => resolve(null));
    request.setTimeout(700, () => { request.destroy(); resolve(null); });
  });
}
async function waitForHub() {
  for (let attempt = 0; attempt < 40; attempt += 1) { if (await hubStatus()) return; await new Promise((resolve) => setTimeout(resolve, 150)); }
  throw new Error('The local Hub did not start.');
}
function serverPath() { return app.isPackaged ? path.join(process.resourcesPath, 'sync-server', 'hub.mjs') : path.join(directory, '..', '..', 'sync-server', 'hub.mjs'); }
function webPath() { return app.isPackaged ? path.join(process.resourcesPath, 'dist') : path.join(directory, '..', '..', 'dist'); }
let lastTraySignature = '';
async function trayIcon() {
  // Native template PNG keeps the glyph crisp in light and dark mode and avoids SVG rasterisation limits.
  const base = nativeImage.createFromBuffer(await fs.readFile(path.join(directory, 'trayTemplate.png')));
  const retina = nativeImage.createFromBuffer(await fs.readFile(path.join(directory, 'trayTemplate@2x.png')));
  if (!retina.isEmpty()) base.addRepresentation({ scaleFactor: 2, buffer: retina.toPNG() });
  base.setTemplateImage(true); return base;
}
function refreshTray() {
  const signature = `${state.running}:${state.deviceCount}:${restarting}`;
  if (signature === lastTraySignature) return;
  lastTraySignature = signature;
  if (!tray) return;
  tray.setToolTip(state.deviceCount > 0 ? copy.tooltipDevices(state.deviceCount) : copy.tooltip);
  tray.setContextMenu(buildMenu());
}
function lanAddress() {
  const interfaces = os.networkInterfaces();
  const virtual = /^(lo|utun|tun|tap|gif|stf|bridge|awdl|llw|ap)\d*/;
  for (const name of ['en0', 'en1', 'en2']) {
    const entry = interfaces[name]?.find((candidate) => candidate.family === 'IPv4' && !candidate.internal);
    if (entry) return entry.address;
  }
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (virtual.test(name)) continue;
    const entry = addresses?.find((candidate) => candidate.family === 'IPv4' && !candidate.internal);
    if (entry) return entry.address;
  }
  return undefined;
}
async function hubStoreKey() {
  if (process.env.MHD_HUB_STORE_KEY) return process.env.MHD_HUB_STORE_KEY;
  // Development builds are unsigned and would trigger a Keychain prompt on every
  // launch. Keep the dev store isolated with its own private key file instead.
  if (!app.isPackaged) {
    const keyFile = path.join(app.getPath('userData'), 'dev', 'hub-dev-store-key');
    try { return (await fs.readFile(keyFile, 'utf8')).trim(); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      const key = crypto.randomBytes(32).toString('base64');
      await fs.mkdir(path.dirname(keyFile), { recursive: true });
      await fs.writeFile(keyFile, key, { mode: 0o600 });
      return key;
    }
  }
  if (!safeStorage.isEncryptionAvailable()) throw new Error('The operating-system keychain is unavailable, so encrypted Hub storage cannot be started.');
  const keyFile = path.join(app.getPath('userData'), 'hub-store-key');
  try { return safeStorage.decryptString(await fs.readFile(keyFile)).trim(); }
  catch (error) {
    if (error.code !== 'ENOENT') throw error;
    const key = crypto.randomBytes(32).toString('base64');
    await fs.writeFile(keyFile, safeStorage.encryptString(key), { mode: 0o600 });
    return key;
  }
}
function hubDataPath() {
  return app.isPackaged
    ? path.join(app.getPath('userData'), 'hub-data')
    : path.join(app.getPath('userData'), 'dev', 'hub-data');
}
async function startHub() {
  const localAddress = lanAddress();
  const encryptionKey = await hubStoreKey();
  const environment = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(port),
    MHD_HUB_HOST: '127.0.0.1',
    // Bind only to the selected LAN interface for iPhone pairing/sync. If the
    // Mac has no LAN IPv4 address, keep sync loopback-only instead of listening
    // on every interface (including VPN or potentially public interfaces).
    MHD_HUB_SYNC_HOST: localAddress || '127.0.0.1',
    MHD_HUB_SYNC_PORT: String(syncPort),
    MHD_HUB_PAIRING_ENDPOINT: process.env.MHD_HUB_PAIRING_ENDPOINT || (localAddress ? `http://${localAddress}:${syncPort}` : address),
    MHD_HUB_STORE_KEY: encryptionKey,
    MHD_HUB_REQUIRE_ENCRYPTION: '1',
    MHD_HUB_DATA: hubDataPath(),
    MHD_WEB_DIST: webPath(),
  };
  hub = spawn(process.execPath, [serverPath()], { env: environment, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
  const logPath = path.join(path.dirname(hubDataPath()), 'hub.log');
  hub.stderr?.setEncoding('utf8');
  hub.stderr?.on('data', (chunk) => { fs.appendFile(logPath, `[${new Date().toISOString()}] ${chunk}`).catch(() => {}); });
  hub.once('error', (error) => { fs.appendFile(logPath, `[${new Date().toISOString()}] spawn failed: ${error.message}\n`).catch(() => {}); });
  hub.once('exit', () => {
    if (quitting || restarting) return;
    state = { running: false, deviceCount: 0 };
    refreshTray();
    scheduleHubRestart();
  });
}
function scheduleHubRestart() {
  if (quitting || hubRestarts >= 5) return;
  hubRestarts += 1;
  setTimeout(() => { void bootHub(false); }, 3000);
}
async function bootHub(showDialog) {
  try {
    await startHub();
    await waitForHub();
    advertiseHub();
    await refreshStatus();
    hubRestarts = 0;
  } catch (error) {
    state = { running: false, deviceCount: 0 }; refreshTray();
    if (!quitting && hubRestarts < 5) { scheduleHubRestart(); return; }
    if (showDialog) await dialog.showMessageBox({ type: 'error', message: copy.bootError, detail: error instanceof Error ? error.message : copy.unknownError });
  }
}
async function restartHub() {
  if (restarting) return;
  restarting = true; state = { running: false, deviceCount: 0 }; refreshTray();
  try {
    if (hub && !hub.killed) {
      const exited = new Promise((resolve) => hub.once('exit', resolve));
      hub.kill();
      await Promise.race([exited, new Promise((resolve) => setTimeout(resolve, 3000))]);
    }
    stopAdvertisingHub();
    await bootHub(true);
  } finally {
    restarting = false;
    refreshStatus();
  }
}
function advertiseHub() {
  if (hubAdvertisement) return;
  bonjour = new Bonjour({}, () => {});
  hubAdvertisement = bonjour.publish({ name: 'MyHealthData Hub', type: 'myhealthdata', protocol: 'tcp', port: syncPort, txt: { protocol: '2' } });
}
function stopAdvertisingHub() {
  hubAdvertisement?.stop(); hubAdvertisement = undefined;
  bonjour?.destroy(); bonjour = undefined;
}
function buildMenu() {
  const statusLabel = restarting ? copy.restarting : !state.running ? copy.offline : state.deviceCount > 0 ? copy.runningDevices(state.deviceCount) : copy.running;
  return Menu.buildFromTemplate([
    { label: copy.appName, enabled: false },
    { label: statusLabel, enabled: false },
    { type: 'separator' },
    { label: copy.launch, enabled: state.running, click: () => shell.openExternal(address) },
    { label: copy.connect, enabled: state.running, click: () => shell.openExternal(`${address}?view=devices`) },
    { label: copy.copyAddress, enabled: state.running, click: () => clipboard.writeText(address) },
    { type: 'separator' },
    { label: copy.restart, enabled: !restarting, click: () => { void restartHub(); } },
    { label: copy.startAtLogin, type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin, click: (item) => app.setLoginItemSettings({ openAtLogin: item.checked }) },
    { role: 'about', label: copy.about },
    { type: 'separator' },
    { label: copy.quit, click: () => { quitting = true; app.quit(); } },
  ]);
}
async function refreshStatus() {
  const status = await hubStatus();
  state = { running: Boolean(status), deviceCount: Number(status?.deviceCount || 0) };
  refreshTray();
}
const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => { if (state.running) shell.openExternal(address); });
  app.whenReady().then(async () => {
    app.setAboutPanelOptions({ applicationName: copy.appName, applicationVersion: app.getVersion(), copyright: 'MyHealthData contributors' });
    tray = new Tray(await trayIcon());
    tray.setToolTip(copy.tooltip);
    tray.setContextMenu(buildMenu());
    setInterval(() => { if (!quitting) refreshStatus(); }, 15000).unref?.();
    await bootHub(true);
  });
  app.on('window-all-closed', (event) => event.preventDefault());
  app.on('before-quit', () => { quitting = true; stopAdvertisingHub(); hub?.kill(); });
}
