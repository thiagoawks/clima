// Processo principal: janela, bandeja, login, API do SmartThings, clima, avisos e automações.
const { app, BrowserWindow, ipcMain, safeStorage, shell, Tray, Menu, nativeImage, nativeTheme, Notification, globalShortcut, screen, dialog, clipboard } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { comfort } = require('./shared/comfort');

const API = 'https://api.smartthings.com/v1';
const OAUTH_AUTH = 'https://api.smartthings.com/oauth/authorize';
const OAUTH_TOKEN = 'https://api.smartthings.com/oauth/token';
const SCOPES = 'r:devices:* x:devices:* r:locations:*';
const PAT_LIFE = 24 * 3600000; // a Samsung dá 24 horas para o token pessoal
const ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const dataDir = () => app.getPath('userData');
const configFile = () => path.join(dataDir(), 'config.json');
const energyFile = () => path.join(dataDir(), 'energy.json');
const climateFile = () => path.join(dataDir(), 'climate.json');
const cacheFile = () => path.join(dataDir(), 'cache.json');
const statsFile = () => path.join(dataDir(), 'stats.json');
const logFile = () => path.join(dataDir(), 'clima.log');

const DEFAULTS = {
  theme: 'system', autostart: false, startHidden: false, closeToTray: true,
  notifyComfort: true, notifyWasher: true, notifyTimer: true, notifyFilter: true, forgotHours: 10,
  tariff: 0.85, pollSec: 30, timers: {}, schedules: [], scenes: [], auto: {}, autoStarted: {},
  hotkeys: true, hotkeyDevice: null, budget: 0, mini: false, nightTemp: 23, nightOff: '',
};

let win = null;
let mini = null;
let toast = null;
let tray = null;
let quitting = false;
let lastDevices = [];
let lastLoadAt = 0;
let lastResult = null;
let deviceList = null;   // lista de aparelhos, renovada a cada 30 minutos
let loading = null;      // carga em andamento (evita duas ao mesmo tempo)
let backoffUntil = 0;    // pausa pedida pela Samsung (HTTP 429)
let authDead = false;    // o token parou de funcionar: espera a pessoa renovar
let tokenWarned = false;
let trayHintShown = false;

// ---------- arquivos ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj));
}
function getConfig() {
  const c = { ...DEFAULTS, ...readJson(configFile(), {}) };
  if (!(c.pollSec >= 30)) c.pollSec = 30;
  return c;
}
function saveConfig(c) { writeJson(configFile(), c); }
function hasAuth(c = getConfig()) { return !!(c.oauth?.refresh || c.token); }
function authMode(c = getConfig()) { return c.oauth?.refresh ? 'oauth' : c.token ? 'pat' : null; }
function publicSettings() {
  const c = getConfig();
  const { token, oauth, autoStarted, budgetNotified, filterNotified, tokenSavedAt, lastSeenVersion, ...rest } = c;
  const mode = authMode(c);
  return {
    ...rest, hasToken: !!mode, authMode: mode,
    tokenExpiresAt: mode === 'pat' && tokenSavedAt ? tokenSavedAt + PAT_LIFE : null,
    oauthClientId: oauth?.clientId || '', oauthRedirect: oauth?.redirectUri || 'https://localhost/clima',
    oauthHasSecret: !!oauth?.secret, version: app.getVersion(),
    showNews: lastSeenVersion !== app.getVersion(), apiCalls: stats.n, apiMonth: stats.month,
  };
}
function notify(title, body) {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: ICON });
  n.on?.('click', showWindow);
  n.show();
}

// ---------- registro para diagnóstico (nunca guarda token nem senha) ----------
const logRing = [];
let lastLogMsg = '';
function logLine(kind, msg) {
  const text = `${kind}: ${String(msg).replace(/\s+/g, ' ').slice(0, 300)}`;
  if (text === lastLogMsg) return; // não repete a mesma linha em sequência
  lastLogMsg = text;
  const line = `${new Date().toLocaleString('sv-SE')} ${text}`;
  logRing.push(line);
  if (logRing.length > 150) logRing.shift();
  try { fs.appendFileSync(logFile(), line + '\n'); } catch { /* disco cheio ou sem permissão: segue sem log */ }
}
function trimLog() {
  try { if (fs.statSync(logFile()).size > 300000) fs.writeFileSync(logFile(), fs.readFileSync(logFile(), 'utf8').slice(-100000)); } catch { /* ainda não existe */ }
}

// ---------- contador de chamadas à API (os planos da Samsung têm limite mensal) ----------
const monthKey = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);
let stats = { month: monthKey(), n: 0 };
let statsDirty = false;
function countCall() {
  if (stats.month !== monthKey()) stats = { month: monthKey(), n: 0 };
  stats.n++;
  statsDirty = true;
}
function flushStats() {
  if (!statsDirty) return;
  statsDirty = false;
  try { writeJson(statsFile(), stats); } catch { /* tenta na próxima */ }
}

// ---------- segredos (criptografados pelo Windows) ----------
function enc(text) {
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(text) : Buffer.from(text, 'utf8');
  return buf.toString('base64');
}
function dec(b64) {
  const buf = Buffer.from(b64, 'base64');
  return safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
}
function resetSession() {
  lastDevices = []; lastLoadAt = 0; lastResult = null; deviceList = null;
  authDead = false; tokenWarned = false; backoffUntil = 0;
}

// ---------- login OAuth (renova sozinho; exige o plano de desenvolvedor da Samsung) ----------
function authorizeUrl(o) {
  return `${OAUTH_AUTH}?` + new URLSearchParams({ client_id: o.clientId, response_type: 'code', redirect_uri: o.redirectUri, scope: SCOPES });
}
async function tokenRequest(o, params) {
  const r = await fetch(OAUTH_TOKEN, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${o.clientId}:${dec(o.secret)}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ client_id: o.clientId, ...params }),
  });
  if (!r.ok) {
    logLine('oauth', `HTTP ${r.status} em ${params.grant_type}`);
    throw new Error(r.status === 400 || r.status === 401 ? 'OAUTH_REJECTED' : `HTTP ${r.status}`);
  }
  return r.json();
}
function storeTokens(j) {
  const c = getConfig();
  c.oauth = { ...c.oauth, access: enc(j.access_token), refresh: enc(j.refresh_token), expiresAt: Date.now() + (j.expires_in || 86000) * 1000 };
  saveConfig(c);
}
let refreshing = null;
function refreshOAuth() {
  if (!refreshing) {
    refreshing = (async () => {
      const o = getConfig().oauth;
      if (!o?.refresh) throw new Error('TOKEN_INVALID');
      try {
        storeTokens(await tokenRequest(o, { grant_type: 'refresh_token', refresh_token: dec(o.refresh) }));
      } catch (e) {
        if (e.message !== 'OAUTH_REJECTED') throw e;
        const c = getConfig();
        delete c.oauth.refresh; delete c.oauth.access;
        saveConfig(c);
        throw new Error('TOKEN_INVALID');
      }
    })().finally(() => { refreshing = null; });
  }
  return refreshing;
}
async function accessToken() {
  const c = getConfig();
  if (c.oauth?.refresh) {
    if (!c.oauth.access || c.oauth.expiresAt - Date.now() < 5 * 60000) await refreshOAuth();
    return dec(getConfig().oauth.access);
  }
  if (c.token) return dec(c.token);
  throw new Error('NO_TOKEN');
}
async function exchangeCode(codeOrUrl) {
  let code = String(codeOrUrl || '').trim();
  if (code.includes('code=')) { try { code = new URL(code).searchParams.get('code') || ''; } catch { code = (code.match(/code=([^&\s]+)/) || [])[1] || ''; } }
  if (!code) return { ok: false, error: 'NO_CODE' };
  const o = getConfig().oauth;
  if (!o?.clientId || !o.secret) return { ok: false, error: 'MISSING' };
  try {
    storeTokens(await tokenRequest(o, { grant_type: 'authorization_code', code, redirect_uri: o.redirectUri }));
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}
// Abre o login da Samsung numa janela do app e captura o código na volta,
// antes de a Redirect URI ser carregada (ela nem precisa existir).
function oauthWindow() {
  return new Promise(resolve => {
    const o = getConfig().oauth;
    let done = false;
    const authWin = new BrowserWindow({
      width: 520, height: 740, parent: win || undefined, title: 'Entrar com a Samsung', autoHideMenuBar: true, icon: ICON,
      webPreferences: { partition: 'oauth-login', sandbox: true, contextIsolation: true },
    });
    authWin.webContents.session.webRequest.onBeforeRequest({ urls: [new URL(o.redirectUri).origin + '/*'] }, (d, cb) => {
      if (done || !d.url.startsWith(o.redirectUri)) return cb({});
      done = true;
      cb({ cancel: true });
      const url = d.url;
      setImmediate(async () => { if (!authWin.isDestroyed()) authWin.close(); resolve(await exchangeCode(url)); });
    });
    authWin.on('closed', () => { if (!done) { done = true; resolve({ ok: false, error: 'CANCELLED' }); } });
    authWin.loadURL(authorizeUrl(o));
  });
}

// ---------- token pessoal (24 h) ----------
// Testa o token antes de salvar: um token ruim nunca apaga o que estava funcionando.
async function saveToken(raw) {
  const token = String(raw || '').trim();
  if (!/^[A-Za-z0-9\-_.~]{16,200}$/.test(token)) return { ok: false, error: 'NOT_A_TOKEN' };
  let r;
  try {
    countCall();
    r = await fetch(API + '/devices', { headers: { Authorization: 'Bearer ' + token } });
  } catch (e) {
    logLine('token', 'sem rede: ' + e.message);
    return { ok: false, error: 'NETWORK' };
  }
  if (!r.ok) {
    const body = (await r.text().catch(() => '')).slice(0, 160);
    logLine('token', `recusado: HTTP ${r.status} ${body}`);
    return { ok: false, error: r.status === 401 ? 'TOKEN_INVALID' : r.status === 403 ? 'FORBIDDEN' : 'HTTP', status: r.status };
  }
  const c = getConfig();
  c.token = enc(token);
  c.tokenSavedAt = Date.now();
  if (c.oauth) { delete c.oauth.refresh; delete c.oauth.access; }
  saveConfig(c);
  resetSession();
  logLine('token', 'novo token salvo');
  return { ok: true };
}

// ---------- aplicar configurações ----------
function applyTheme(theme) {
  nativeTheme.themeSource = ['light', 'dark'].includes(theme) ? theme : 'system';
}
function applyAutostart(c) {
  if (process.platform !== 'win32' && process.platform !== 'darwin') return;
  app.setLoginItemSettings({
    openAtLogin: !!c.autostart,
    path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath,
    args: c.startHidden ? ['--hidden'] : [],
  });
}

// ---------- SmartThings ----------
async function st(p, opts = {}, retry = true) {
  const token = await accessToken();
  countCall();
  let r;
  try {
    r = await fetch(API + p, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
  } catch (e) {
    logLine('rede', `${p}: ${e.message}`);
    throw new Error('NETWORK');
  }
  if (r.status === 401 && retry && getConfig().oauth?.refresh) {
    await refreshOAuth();
    return st(p, opts, false);
  }
  if (r.ok) return r.status === 204 ? null : r.json();
  const body = (await r.text().catch(() => '')).slice(0, 200);
  logLine('api', `HTTP ${r.status} em ${p} ${body}`);
  if (r.status === 401) throw new Error('TOKEN_INVALID');
  if (r.status === 403) throw new Error('FORBIDDEN');
  if (r.status === 429) { backoffUntil = Date.now() + 90000; throw new Error('RATE_LIMIT'); }
  throw new Error(`HTTP ${r.status}: ${body}`);
}
const FATAL = ['TOKEN_INVALID', 'FORBIDDEN', 'RATE_LIMIT', 'NETWORK', 'NO_TOKEN'];
const cmd = (capability, command, args = []) => ({ component: 'main', capability, command, arguments: args });
async function sendCommands(id, commands) {
  lastLoadAt = 0; // o estado vai mudar: a próxima leitura busca de novo
  return st(`/devices/${id}/commands`, { method: 'POST', body: JSON.stringify({ commands }) });
}
function onCommands({ mode, setpoint, special }) {
  const list = [cmd('switch', 'on')];
  if (mode) list.push(cmd('airConditionerMode', 'setAirConditionerMode', [mode]));
  if (setpoint && mode !== 'wind') list.push(cmd('thermostatCoolingSetpoint', 'setCoolingSetpoint', [setpoint]));
  if (special) list.push(cmd('custom.airConditionerOptionalMode', 'setAcOptionalMode', [special]));
  return list;
}

const val = (main, cap, attr) => main?.[cap]?.[attr]?.value ?? null;

function mapAc(dev, main) {
  const pc = val(main, 'powerConsumptionReport', 'powerConsumption') || {};
  const range = val(main, 'thermostatCoolingSetpoint', 'coolingSetpointRange') || { minimum: 16, maximum: 30, step: 1 };
  return {
    id: dev.deviceId, kind: 'ac', name: dev.name,
    on: val(main, 'switch', 'switch') === 'on',
    mode: val(main, 'airConditionerMode', 'airConditionerMode'),
    modes: val(main, 'airConditionerMode', 'supportedAcModes') || [],
    setpoint: val(main, 'thermostatCoolingSetpoint', 'coolingSetpoint'),
    min: range.minimum, max: range.maximum, step: range.step || 1,
    temp: val(main, 'temperatureMeasurement', 'temperature'),
    humidity: val(main, 'relativeHumidityMeasurement', 'humidity'),
    fan: val(main, 'airConditionerFanMode', 'fanMode'),
    fans: val(main, 'airConditionerFanMode', 'supportedAcFanModes') || [],
    fansAvailable: val(main, 'airConditionerFanMode', 'availableAcFanModes'),
    osc: val(main, 'fanOscillationMode', 'fanOscillationMode'),
    oscs: val(main, 'fanOscillationMode', 'supportedFanOscillationModes') || [],
    special: val(main, 'custom.airConditionerOptionalMode', 'acOptionalMode'),
    specials: val(main, 'custom.airConditionerOptionalMode', 'supportedAcOptionalMode') || [],
    autoClean: val(main, 'custom.autoCleaningMode', 'autoCleaningMode'),
    power: typeof pc.power === 'number' ? pc.power : null,
    energy: typeof pc.energy === 'number' ? pc.energy : null,
    filterUsage: val(main, 'custom.dustFilter', 'dustFilterUsage'),
    filterCapacity: val(main, 'custom.dustFilter', 'dustFilterCapacity'),
    filterStatus: val(main, 'custom.dustFilter', 'dustFilterStatus'),
  };
}

function mapWasher(dev, main) {
  const s = 'samsungce.washerOperatingState';
  return {
    id: dev.deviceId, kind: 'washer', name: dev.name,
    state: val(main, s, 'operatingState') || val(main, 'washerOperatingState', 'machineState'),
    job: val(main, s, 'washerJobState') || val(main, 'washerOperatingState', 'washerJobState'),
    progress: val(main, s, 'progress'),
    remaining: val(main, s, 'remainingTime'),
    phases: val(main, s, 'scheduledPhases') || [],
    remote: val(main, 'remoteControlStatus', 'remoteControlEnabled') === 'true',
    kidsLock: val(main, 'samsungce.kidsLock', 'lockState') === 'locked',
    spin: val(main, 'custom.washerSpinLevel', 'washerSpinLevel'),
    rinses: val(main, 'custom.washerRinseCycles', 'washerRinseCycles'),
  };
}

// ---------- históricos (a API só dá o valor atual, então o app anota) ----------
const dayKey = (d = new Date()) => d.toLocaleDateString('sv-SE'); // AAAA-MM-DD local
const trimDays = (days, n) => Object.fromEntries(Object.keys(days).sort().slice(-n).map(k => [k, days[k]]));
const sum = a => (a ? a.reduce((x, y) => x + y, 0) : 0);

// O medidor do ar é acumulado. A diferença desde a última leitura é repartida pelas horas
// que passaram, então o gráfico continua certo mesmo se o app ficou fechado por um tempo.
function recordEnergy(acs) {
  const store = readJson(energyFile(), { last: {}, days: {} });
  store.last ||= {}; store.days ||= {};
  const now = new Date();
  for (const ac of acs) {
    if (ac.energy == null) continue;
    const last = store.last[ac.id];
    const delta = last ? ac.energy - last.e : 0;
    if (last && delta > 0) {
      const slots = [];
      const end = new Date(now); end.setMinutes(0, 0, 0);
      const start = new Date(last.t); start.setMinutes(0, 0, 0);
      for (let t = end.getTime(); t >= start.getTime() && slots.length < 24 * 7; t -= 3600000) slots.push(new Date(t));
      const share = delta / slots.length;
      if (share <= 6000) { // mais que 6 kWh numa hora não é um ar de quarto: medidor reiniciou
        for (const s of slots) {
          const day = (store.days[dayKey(s)] ||= {});
          (day[ac.id] ||= Array(24).fill(0))[s.getHours()] += share;
        }
      }
    }
    store.last[ac.id] = { e: ac.energy, t: now.toISOString() };
  }
  store.days = trimDays(store.days, 100);
  writeJson(energyFile(), store);
  return store;
}
function energyFor(store, id) {
  const now = new Date();
  const y = new Date(now); y.setDate(y.getDate() - 1);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now); d.setDate(d.getDate() - i);
    week.push({ date: dayKey(d), wh: sum(store.days[dayKey(d)]?.[id]) });
  }
  const monthDays = [];
  for (let day = 1; day <= now.getDate(); day++) {
    const k = dayKey(new Date(now.getFullYear(), now.getMonth(), day));
    monthDays.push({ date: k, wh: sum(store.days[k]?.[id]) });
  }
  // mês passado até o mesmo dia, para comparar
  let prevSame = 0, prevDays = 0;
  for (let day = 1; day <= now.getDate(); day++) {
    const d = new Date(now.getFullYear(), now.getMonth() - 1, day);
    if (d.getMonth() === now.getMonth()) break; // mês passado mais curto
    const v = store.days[dayKey(d)]?.[id];
    if (v) { prevSame += sum(v); prevDays++; }
  }
  return {
    hours: store.days[dayKey(now)]?.[id] || Array(24).fill(0), yHours: store.days[dayKey(y)]?.[id] || null,
    week, monthDays, month: monthDays.reduce((s, x) => s + x.wh, 0), prevSame: prevDays >= now.getDate() - 2 ? prevSame : null,
  };
}
function recordClimate(acs) {
  const store = readJson(climateFile(), { days: {} });
  const day = dayKey(), h = new Date().getHours();
  store.days[day] ||= {};
  for (const ac of acs) {
    if (ac.temp == null) continue;
    const s = (store.days[day][ac.id] ||= { t: Array(24).fill(0), h: Array(24).fill(0), n: Array(24).fill(0) });
    s.t[h] += ac.temp; s.h[h] += ac.humidity ?? 0; s.n[h] += 1;
  }
  store.days = trimDays(store.days, 8);
  writeJson(climateFile(), store);
  for (const ac of acs) {
    const s = store.days[day][ac.id];
    ac.climate = s ? { t: s.t.map((v, i) => (s.n[i] ? v / s.n[i] : null)), h: s.h.map((v, i) => (s.n[i] ? v / s.n[i] : null)) } : null;
  }
}

// ---------- local + clima (Open-Meteo, sem chave) ----------
let locCache = null;
let weatherCache = { at: 0, data: null };
async function getLocation(locationId) {
  if (locCache?.id === locationId) return locCache;
  try {
    const l = await st(`/locations/${locationId}`);
    locCache = { id: locationId, name: l.name, lat: l.latitude, lon: l.longitude };
  } catch {
    return { id: null, name: 'Casa', lat: -23.55, lon: -46.63 }; // tenta de novo na próxima carga
  }
  if (locCache.lat == null) { locCache.lat = -23.55; locCache.lon = -46.63; }
  return locCache;
}
async function getWeather(loc) {
  if (weatherCache.data && Date.now() - weatherCache.at < 15 * 60 * 1000) return weatherCache.data;
  const u = `https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}` +
    '&current=temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,precipitation' +
    '&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code,sunrise,sunset,uv_index_max' +
    '&timezone=auto&forecast_days=5';
  try {
    const r = await fetch(u);
    if (!r.ok) throw new Error();
    weatherCache = { at: Date.now(), data: await r.json() };
  } catch { /* sem internet: mantém o anterior */ }
  return weatherCache.data;
}

// ---------- carregar tudo ----------
async function getDeviceList() {
  if (deviceList && Date.now() - deviceList.at < 30 * 60000) return deviceList.items;
  const items = [];
  for (const dev of (await st('/devices')).items || []) {
    const caps = (dev.components?.[0]?.capabilities || []).map(c => c.id);
    const isAc = caps.includes('airConditionerMode');
    const isWasher = caps.includes('washerOperatingState');
    if (isAc || isWasher) items.push({ deviceId: dev.deviceId, name: dev.label || dev.name, locationId: dev.locationId, isAc });
  }
  deviceList = { at: Date.now(), items };
  return items;
}
function loadAll(force = false) {
  if (loading) return loading;
  if (lastResult && !force && Date.now() - lastLoadAt < 4000) return Promise.resolve(lastResult);
  if (lastResult && Date.now() < backoffUntil) return Promise.resolve(lastResult);
  loading = doLoad().catch(e => {
    if (e.message === 'TOKEN_INVALID' || e.message === 'FORBIDDEN') authDead = true;
    throw e;
  }).finally(() => { loading = null; flushStats(); });
  return loading;
}
async function doLoad() {
  const list = await getDeviceList();
  const devices = [];
  const weatherP = (list[0]?.locationId ? getLocation(list[0].locationId) : Promise.resolve({ name: 'Casa', lat: -23.55, lon: -46.63 }))
    .then(async loc => ({ loc, weather: await getWeather(loc) }));
  weatherP.catch(() => {});
  await Promise.all(list.map(async dev => {
    try {
      const main = (await st(`/devices/${dev.deviceId}/status`)).components?.main;
      devices.push(dev.isAc ? mapAc(dev, main) : mapWasher(dev, main));
    } catch (e) {
      if (FATAL.includes(e.message)) throw e;
      devices.push({ id: dev.deviceId, kind: dev.isAc ? 'ac' : 'washer', name: dev.name, offline: true });
    }
  }));
  devices.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'ac' ? -1 : 1));
  const acs = devices.filter(d => d.kind === 'ac' && !d.offline);
  const store = recordEnergy(acs);
  for (const ac of acs) ac.history = energyFor(store, ac.id);
  recordClimate(acs);
  afterLoad(devices);
  lastDevices = devices;
  lastLoadAt = Date.now();
  authDead = false;
  updateTray();
  const { loc, weather } = await weatherP;
  const monthWh = acs.reduce((s, d) => s + (d.history?.month || 0), 0);
  checkBudget(monthWh);
  const c = getConfig();
  lastResult = {
    devices, location: loc.name, weather, timers: c.timers, monthWh, at: Date.now(),
    washDone: Object.fromEntries(Object.entries(washDone).map(([id, w]) => [id, w.at])),
  };
  writeJson(cacheFile(), lastResult);
  if (mini && !mini.isDestroyed()) mini.webContents.send('data', lastResult);
  return lastResult;
}
async function ensureFresh(maxAgeMs = 180000) {
  if (!hasAuth() || authDead || Date.now() - lastLoadAt < maxAgeMs) return;
  try { await loadAll(); } catch (e) {
    if ((e.message === 'TOKEN_INVALID' || e.message === 'FORBIDDEN') && !tokenWarned) {
      tokenWarned = true;
      notify('O Clima perdeu a conexão com o SmartThings', authMode() === 'pat' ? 'O token de 24 horas expirou. Abra o Clima para colar um novo.' : 'Abra o Clima para entrar de novo.');
    }
  }
}

// ---------- avisos (rodam aqui para funcionar com a janela fechada) ----------
const onSince = {};          // desde quando cada ar está ligado
const onExact = {};          // true quando o app viu o momento em que ligou
const forgotNotified = {};
const comfortNotified = new Set();
const prevWasher = {};
const prevOn = {};
const quietUntil = {};
const washDone = {};         // lavagens que terminaram e ainda não foram dispensadas
function afterLoad(devices) {
  const c = getConfig();
  let dirty = false;
  c.filterNotified ||= {};
  for (const d of devices) {
    if (d.offline) continue;
    if (d.kind === 'washer') {
      const running = d.state === 'running';
      if (prevWasher[d.id] === true && !running && d.state !== 'paused') {
        washDone[d.id] = { at: Date.now(), n: 0 };
        if (c.notifyWasher) notify(`${d.name}: a lavagem terminou`, 'Hora de estender a roupa.');
      }
      if (running) delete washDone[d.id];
      prevWasher[d.id] = running;
      continue;
    }
    const name = shortName(d.name);
    if (d.on) {
      if (!onSince[d.id]) { onSince[d.id] = Date.now(); onExact[d.id] = d.id in onExact; }
      const hours = (Date.now() - onSince[d.id]) / 3600000;
      if (c.forgotHours > 0 && hours >= c.forgotHours && !forgotNotified[d.id]) {
        forgotNotified[d.id] = true;
        notify(`${name} está ligado há ${onExact[d.id] ? '' : 'mais de '}${Math.floor(hours)} horas`, 'Se foi esquecido, dá para desligar pelo ícone da bandeja.');
      }
    } else {
      delete onSince[d.id]; delete forgotNotified[d.id];
      onExact[d.id] = true; // já foi visto desligado: a próxima vez que ligar, a hora é exata
    }
    d.onSince = d.on && onExact[d.id] ? onSince[d.id] : null;
    // alguém acabou de desligar: não sugere ligar de novo pelas próximas 2 horas
    if (prevOn[d.id] === true && !d.on) quietUntil[d.id] = Date.now() + 2 * 3600000;
    prevOn[d.id] = d.on;
    const cf = comfort(d.temp, d.humidity, d.modes);
    if (!d.on && cf?.action && !c.auto[d.id] && Date.now() >= (quietUntil[d.id] || 0)) {
      if (!comfortNotified.has(d.id)) {
        comfortNotified.add(d.id);
        if (c.notifyComfort) notify(`${name}: ${cf.label.toLowerCase()} (${cf.why})`, `Recomendado: ${cf.action.text.toLowerCase()}.`);
      }
    } else comfortNotified.delete(d.id);
    const full = (d.filterCapacity && d.filterUsage >= d.filterCapacity) || (d.filterStatus && d.filterStatus !== 'normal');
    if (full && !c.filterNotified[d.id]) {
      c.filterNotified[d.id] = true; dirty = true;
      if (c.notifyFilter) notify(`${name}: hora de lavar o filtro`, 'O filtro chegou ao limite de horas de uso. Tire, lave com água e deixe secar.');
    } else if (!full && c.filterNotified[d.id]) { delete c.filterNotified[d.id]; dirty = true; }
  }
  if (dirty) saveConfig(c);
}
function washerReminders() {
  const c = getConfig();
  for (const [id, w] of Object.entries(washDone)) {
    if (w.n < 2 && Date.now() - w.at >= (w.n + 1) * 15 * 60000) {
      w.n++;
      if (c.notifyWasher) notify(`${nameOf(id)}: a roupa ainda está lá`, `A lavagem terminou há ${w.n * 15} minutos.`);
    }
  }
}
function tokenReminder() {
  const c = getConfig();
  if (authMode(c) !== 'pat' || !c.tokenSavedAt || tokenWarned) return;
  const left = c.tokenSavedAt + PAT_LIFE - Date.now();
  if (left < 2 * 3600000) {
    tokenWarned = true;
    notify('O token do SmartThings está para expirar', 'Abra o Clima e cole um token novo para não perder a conexão.');
  }
}

// ---------- meta de gasto ----------
function projectMonth(monthWh, tariff) {
  const now = new Date();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return ((monthWh / 1000) * tariff / now.getDate()) * daysInMonth;
}
function checkBudget(monthWh) {
  const c = getConfig();
  const month = dayKey().slice(0, 7);
  if (!c.budget || c.budgetNotified === month || new Date().getDate() < 5) return;
  const proj = projectMonth(monthWh, c.tariff);
  if (proj <= c.budget) return;
  c.budgetNotified = month;
  saveConfig(c);
  const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  notify('Gasto com ar acima da meta', `No ritmo atual, o mês fecha em ${brl(proj)}. A meta é ${brl(c.budget)}.`);
}

// ---------- timers de desligar ----------
const shortName = n => String(n || '').replace(/^ar[\s-]*condicionado\s*/i, '').trim() || n;
const nameOf = id => shortName(lastDevices.find(d => d.id === id)?.name || 'Ar-condicionado');
const liveAcs = () => lastDevices.filter(d => d.kind === 'ac' && !d.offline);
const refreshSoon = (ms = 1500) => setTimeout(() => win?.webContents.send('refresh'), ms);
function setTimer(id, minutes) {
  const c = getConfig();
  if (minutes > 0) c.timers[id] = Date.now() + minutes * 60000;
  else delete c.timers[id];
  saveConfig(c);
  return c.timers;
}
async function checkTimers() {
  const c = getConfig();
  const due = Object.entries(c.timers).filter(([, end]) => end <= Date.now());
  if (!due.length) return;
  for (const [id] of due) {
    delete c.timers[id];
    try {
      await sendCommands(id, [cmd('switch', 'off')]);
      logLine('timer', `desligou ${nameOf(id)}`);
      if (c.notifyTimer) notify(`${nameOf(id)} desligado`, 'O timer terminou.');
    } catch (e) {
      logLine('timer', `falhou: ${e.message}`);
      c.timers[id] = Date.now() + 60000;
    }
  }
  const fresh = getConfig(); fresh.timers = c.timers; saveConfig(fresh);
  win?.webContents.send('refresh');
}

// ---------- agendamentos (com pré-resfriar) ----------
function scheduleTargets(s) {
  const acs = liveAcs();
  return s.deviceId === 'all' ? acs : acs.filter(d => d.id === s.deviceId);
}
function scheduleSoon(c, minutes = 60) {
  const now = new Date();
  return c.schedules.some(s => {
    if (!s.enabled || s.action !== 'on' || !s.precool || !s.days.includes(now.getDay()) || s.lastRun === dayKey(now)) return false;
    const [hh, mm] = s.time.split(':').map(Number);
    const target = new Date(now); target.setHours(hh, mm, 0, 0);
    const diff = (target - now) / 60000;
    return diff > -10 && diff <= minutes;
  });
}
async function checkSchedules() {
  const c = getConfig();
  const now = new Date();
  let changed = false;
  for (const s of c.schedules) {
    if (!s.enabled || !s.days.includes(now.getDay()) || s.lastRun === dayKey(now)) continue;
    const [hh, mm] = s.time.split(':').map(Number);
    const target = new Date(now); target.setHours(hh, mm, 0, 0);
    const targets = scheduleTargets(s);
    let lead = 0;
    if (s.action === 'on' && s.precool && s.mode !== 'wind') {
      // estimativa simples: uns 6 minutos por grau de diferença, no máximo 45 minutos antes
      const gap = Math.max(0, ...targets.map(d => Math.abs((d.temp ?? s.setpoint) - s.setpoint)));
      lead = Math.min(45, Math.round(gap * 6));
    }
    const diff = now - target; // ms depois do horário
    if (diff < -lead * 60000 || diff > 10 * 60000 || !targets.length) continue;
    const early = Math.round(-diff / 60000);
    s.lastRun = dayKey(now);
    changed = true;
    let failed = 0;
    for (const d of targets) {
      try { await sendCommands(d.id, s.action === 'off' ? [cmd('switch', 'off')] : onCommands(s)); } catch (e) { failed++; logLine('agenda', `falhou em ${shortName(d.name)}: ${e.message}`); }
    }
    const who = s.deviceId === 'all' ? 'Todos os ares' : nameOf(s.deviceId);
    logLine('agenda', `${s.time} ${s.action} ${who}`);
    if (failed === targets.length) notify(`Agendamento das ${s.time} falhou`, `Não consegui falar com ${who.toLowerCase()}.`);
    else notify(`Agendamento das ${s.time}`, s.action === 'off' ? `${who}: desligado.` : `${who}: ligado${early > 0 ? ` ${early} min antes, para chegar em ${s.setpoint}° no horário` : ''}.`);
  }
  if (changed) {
    const fresh = getConfig(); fresh.schedules = c.schedules; saveConfig(fresh);
    refreshSoon(2000);
  }
}

// ---------- cenas (um clique muda um ar ou todos) e boa noite ----------
async function runScene(id) {
  const s = id === 'all-off' ? { name: 'Desligar tudo', deviceId: 'all', action: 'off' } : getConfig().scenes.find(x => x.id === id);
  if (!s) return { ok: false, n: 0, total: 0 };
  await ensureFresh(120000);
  const acs = liveAcs();
  const targets = s.deviceId === 'all' ? acs : acs.filter(d => d.id === s.deviceId);
  let n = 0;
  for (const d of targets) {
    if (s.action === 'off' && !d.on) { n++; continue; }
    try {
      await sendCommands(d.id, s.action === 'off' ? [cmd('switch', 'off')]
        : onCommands({ mode: s.mode, setpoint: s.setpoint, special: s.special && d.specials?.includes(s.special) ? s.special : null }));
      n++;
    } catch (e) { logLine('cena', `${s.name} falhou em ${shortName(d.name)}: ${e.message}`); }
  }
  logLine('cena', `${s.name}: ${n} de ${targets.length}`);
  refreshSoon();
  return { ok: targets.length > 0 && n === targets.length, n, total: targets.length, name: s.name };
}
async function runNight(id) {
  const c = getConfig();
  const d = lastDevices.find(x => x.id === id);
  if (!d) throw new Error('NO_DEVICE');
  const special = d.specials?.includes('windFreeSleep') ? 'windFreeSleep' : d.specials?.includes('sleep') ? 'sleep' : null;
  const setpoint = Math.min(d.max ?? 30, Math.max(d.min ?? 16, c.nightTemp));
  await sendCommands(id, onCommands({ mode: 'cool', setpoint, special }));
  let timers = c.timers;
  if (/^\d\d:\d\d$/.test(c.nightOff)) {
    const [hh, mm] = c.nightOff.split(':').map(Number);
    const end = new Date(); end.setHours(hh, mm, 0, 0);
    if (end <= new Date()) end.setDate(end.getDate() + 1);
    timers = setTimer(id, Math.round((end - Date.now()) / 60000));
  }
  return { setpoint, special, timers };
}

// ---------- conforto automático ----------
const autoLast = {};   // último comando automático por aparelho
const autoPause = {};  // pausa depois que a pessoa desliga na mão
async function autoComfort() {
  const c = getConfig();
  const ids = Object.keys(c.auto).filter(id => c.auto[id]);
  if (!ids.length) return;
  await ensureFresh(); // nunca decide com dado velho
  if (Date.now() - lastLoadAt > 5 * 60000) return; // não conseguiu atualizar: não mexe em nada
  let changed = false;
  for (const id of ids) {
    const d = lastDevices.find(x => x.id === id);
    if (!d || d.offline) continue;
    if (!d.on && c.autoStarted[id]) {
      // foi ligado pelo automático e alguém desligou: respeita e pausa por 2 horas
      delete c.autoStarted[id]; changed = true;
      autoPause[id] = Date.now() + 2 * 3600000;
      continue;
    }
    if (Date.now() < (autoPause[id] || 0) || Date.now() - (autoLast[id] || 0) < 20 * 60000) continue;
    const cf = comfort(d.temp, d.humidity, d.modes);
    if (!d.on && cf?.action) {
      try {
        await sendCommands(id, onCommands(cf.action));
        autoLast[id] = Date.now(); c.autoStarted[id] = true; changed = true;
        logLine('auto', `ligou ${shortName(d.name)} (${cf.why})`);
        notify(`${shortName(d.name)}: ar ligado sozinho`, `Estava ${cf.label.toLowerCase()} (${cf.why}). ${cf.action.text.replace('Ligar', 'Ligado')}.`);
      } catch { /* tenta na próxima */ }
    } else if (d.on && c.autoStarted[id] && cf?.level === 'ok') {
      const out = weatherCache.data?.current?.apparent_temperature;
      if (out != null && out <= 22) {
        try {
          await sendCommands(id, [cmd('switch', 'off')]);
          autoLast[id] = Date.now(); delete c.autoStarted[id]; changed = true;
          logLine('auto', `desligou ${shortName(d.name)}`);
          notify(`${shortName(d.name)}: ar desligado sozinho`, `O quarto está confortável e lá fora está ${Math.round(out)}°.`);
        } catch { /* tenta na próxima */ }
      }
    }
  }
  if (changed) {
    const fresh = getConfig(); fresh.autoStarted = c.autoStarted; saveConfig(fresh);
    refreshSoon(2000);
  }
}

// ---------- volta periódica ----------
// Com a janela aberta, quem atualiza é a própria janela. Escondido na bandeja, o app
// consulta a Samsung só o quanto precisa, para não gastar o limite mensal de chamadas.
const winVisible = () => !!win && win.isVisible() && !win.isMinimized();
function backgroundMaxAge() {
  const c = getConfig();
  if (winVisible()) return Math.max(c.pollSec * 2000, 60000);
  if (mini && !mini.isDestroyed()) return 60000;
  let age = c.notifyComfort ? 10 * 60000 : 15 * 60000;
  if (lastDevices.some(d => d.kind === 'washer' && d.state === 'running')) age = Math.min(age, 2 * 60000);
  if (Object.values(c.auto).some(Boolean) || scheduleSoon(c)) age = Math.min(age, 3 * 60000);
  return age;
}
let tickCount = 0;
let ticking = false;
async function tick() {
  if (ticking || !hasAuth()) return;
  ticking = true;
  try {
    const c = getConfig();
    // renova o login com folga, para o refresh token nunca ficar parado
    if (c.oauth?.refresh && c.oauth.expiresAt - Date.now() < 6 * 3600000) await refreshOAuth().catch(() => {});
    tokenReminder();
    if (!authDead) {
      await checkTimers();
      await ensureFresh(backgroundMaxAge());
      await checkSchedules();
      if (tickCount++ % 4 === 0) await autoComfort();
    }
    washerReminders();
  } catch (e) { logLine('volta', e.message); }
  flushStats();
  ticking = false;
}

// ---------- atalhos globais e aviso na tela ----------
function hotkeyDevice() {
  const acs = liveAcs();
  return acs.find(d => d.id === getConfig().hotkeyDevice) || acs[0];
}
function showToast(text) {
  if (!toast || toast.isDestroyed()) {
    toast = new BrowserWindow({
      width: 300, height: 64, frame: false, transparent: true, alwaysOnTop: true, skipTaskbar: true,
      focusable: false, resizable: false, show: false, hasShadow: false, webPreferences: { sandbox: true },
    });
    toast.setIgnoreMouseEvents(true);
  }
  const wa = screen.getPrimaryDisplay().workArea;
  toast.setPosition(Math.round(wa.x + (wa.width - 300) / 2), wa.y + wa.height - 110);
  toast.loadFile(path.join(__dirname, 'renderer', 'toast.html'), { hash: encodeURIComponent(text) });
  toast.showInactive();
  clearTimeout(showToast.t);
  showToast.t = setTimeout(() => { if (toast && !toast.isDestroyed()) toast.hide(); }, 1800);
}
let hotkeyTimer = null;
async function hotkeySetpoint(dir) {
  await ensureFresh(120000);
  const d = hotkeyDevice();
  if (!d) return showToast('Nenhum ar encontrado');
  if (!d.on) return showToast(`${shortName(d.name)} está desligado`);
  d.setpoint = Math.min(d.max, Math.max(d.min, (d.setpoint ?? 24) + dir));
  showToast(`${shortName(d.name)} · ${d.setpoint}°`);
  clearTimeout(hotkeyTimer);
  hotkeyTimer = setTimeout(async () => {
    try { await sendCommands(d.id, [cmd('thermostatCoolingSetpoint', 'setCoolingSetpoint', [d.setpoint])]); } catch { showToast('Não consegui enviar o comando'); }
    refreshSoon();
  }, 600);
}
async function hotkeyPower() {
  await ensureFresh(120000);
  const d = hotkeyDevice();
  if (!d) return showToast('Nenhum ar encontrado');
  d.on = !d.on;
  showToast(`${shortName(d.name)} · ${d.on ? 'ligado' : 'desligado'}`);
  try { await sendCommands(d.id, [cmd('switch', d.on ? 'on' : 'off')]); } catch { showToast('Não consegui enviar o comando'); }
  refreshSoon();
}
function registerHotkeys() {
  globalShortcut.unregisterAll();
  if (!getConfig().hotkeys) return;
  globalShortcut.register('Control+Alt+Up', () => hotkeySetpoint(1));
  globalShortcut.register('Control+Alt+Down', () => hotkeySetpoint(-1));
  globalShortcut.register('Control+Alt+P', () => hotkeyPower());
}

// ---------- mini janela ----------
function createMini() {
  if (mini && !mini.isDestroyed()) return;
  const wa = screen.getPrimaryDisplay().workArea;
  mini = new BrowserWindow({
    width: 280, height: 128, x: wa.x + wa.width - 300, y: wa.y + wa.height - 148,
    frame: false, resizable: false, alwaysOnTop: true, skipTaskbar: true, show: false, maximizable: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1C1C1E' : '#FFFFFF',
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  mini.loadFile(path.join(__dirname, 'renderer', 'mini.html'));
  mini.once('ready-to-show', () => mini.showInactive());
  mini.on('closed', () => { mini = null; });
}
function setMini(on) {
  const c = getConfig();
  c.mini = on;
  saveConfig(c);
  if (on) createMini(); else if (mini && !mini.isDestroyed()) mini.close();
  updateTray();
  win?.webContents.send('settings');
}

// ---------- bandeja ----------
function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}
function updateTray() {
  if (!tray) return;
  const acs = liveAcs();
  const washer = lastDevices.find(d => d.kind === 'washer' && !d.offline);
  const items = [{ label: 'Abrir o Clima', click: showWindow }, { type: 'separator' }];
  for (const ac of acs) {
    const temp = ac.temp != null ? ` · ambiente ${Math.round(ac.temp)}°` : '';
    items.push({
      label: `${shortName(ac.name)}: ${ac.on ? `ligado em ${ac.setpoint}°` : 'desligado'}${temp}`,
      submenu: [
        { label: ac.on ? 'Desligar' : 'Ligar', click: () => quick(ac.id, [cmd('switch', ac.on ? 'off' : 'on')]) },
        ...(ac.on ? [
          { label: 'Mais frio (−1°)', enabled: ac.setpoint > ac.min, click: () => quick(ac.id, [cmd('thermostatCoolingSetpoint', 'setCoolingSetpoint', [ac.setpoint - 1])]) },
          { label: 'Menos frio (+1°)', enabled: ac.setpoint < ac.max, click: () => quick(ac.id, [cmd('thermostatCoolingSetpoint', 'setCoolingSetpoint', [ac.setpoint + 1])]) },
        ] : [{ label: 'Boa noite', click: () => runNight(ac.id).then(() => refreshSoon(), () => {}) }]),
      ],
    });
  }
  if (acs.length) {
    const scenes = getConfig().scenes;
    if (scenes.length) items.push({ type: 'separator' }, ...scenes.map(s => ({ label: s.name, click: () => runScene(s.id) })));
    items.push({ label: 'Desligar todos os ares', enabled: acs.some(a => a.on), click: () => runScene('all-off') });
  }
  if (washer) {
    const running = washer.state === 'running';
    items.push({ type: 'separator' }, { label: `${washer.name}: ${running ? `termina em ${washer.remaining ?? '?'} min` : 'parada'}`, enabled: false });
  }
  items.push({ type: 'separator' },
    { label: 'Mini janela', type: 'checkbox', checked: !!getConfig().mini, click: m => setMini(m.checked) },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  const on = acs.filter(a => a.on).length;
  tray.setToolTip(acs.length ? `Clima: ${on} de ${acs.length} ares ligados` : 'Clima');
}
async function quick(id, commands) {
  try { await sendCommands(id, commands); } catch (e) { logLine('bandeja', e.message); }
  refreshSoon();
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.on('click', showWindow);
  updateTray();
}

// ---------- exportar consumo e diagnóstico ----------
async function exportEnergy() {
  const store = readJson(energyFile(), { days: {} });
  const names = Object.fromEntries(lastDevices.map(d => [d.id, shortName(d.name)]));
  const rows = ['Data;Hora;Aparelho;kWh'];
  for (const day of Object.keys(store.days || {}).sort()) {
    for (const [id, hours] of Object.entries(store.days[day])) {
      hours.forEach((wh, h) => { if (wh > 0) rows.push(`${day};${String(h).padStart(2, '0')}:00;${names[id] || id};${(wh / 1000).toFixed(3).replace('.', ',')}`); });
    }
  }
  if (rows.length === 1) return { ok: false, error: 'EMPTY' };
  const r = await dialog.showSaveDialog(win, { title: 'Exportar consumo', defaultPath: `clima-consumo-${dayKey()}.csv`, filters: [{ name: 'Planilha CSV', extensions: ['csv'] }] });
  if (r.canceled || !r.filePath) return { ok: false, error: 'CANCELLED' };
  fs.writeFileSync(r.filePath, '\ufeff' + rows.join('\r\n'));
  return { ok: true, rows: rows.length - 1 };
}
function diagText() {
  const c = getConfig();
  const mode = authMode(c);
  const age = c.tokenSavedAt ? ((Date.now() - c.tokenSavedAt) / 3600000).toFixed(1) + ' h' : '?';
  const devs = lastDevices.map(d => `  - ${d.kind} "${shortName(d.name)}"${d.offline ? ' SEM CONEXÃO' : d.kind === 'ac'
    ? ` ${d.on ? 'ligado' : 'desligado'} modos=[${d.modes}] especiais=[${d.specials}] temp=${d.temp} umid=${d.humidity} energia=${d.energy != null}`
    : ` estado=${d.state} remoto=${d.remote}`}`);
  return [
    `Clima ${app.getVersion()}${app.isPackaged ? '' : ' (dev)'} · Electron ${process.versions.electron} · ${os.type()} ${os.release()}`,
    `Conta: ${mode === 'oauth' ? 'login Samsung (OAuth)' : mode === 'pat' ? `token pessoal salvo há ${age}` : 'não conectada'}${authDead ? ' · PAROU DE FUNCIONAR' : ''}`,
    `Chamadas à API em ${stats.month}: ${stats.n} · última leitura: ${lastLoadAt ? new Date(lastLoadAt).toLocaleString('sv-SE') : 'nunca'}`,
    `Agendamentos: ${c.schedules.length} · cenas: ${c.scenes.length} · conforto automático: ${Object.values(c.auto).filter(Boolean).length} · atualizar a cada ${c.pollSec}s`,
    `Atualização: ${updateState.status}${updateState.error ? ' · ' + updateState.error : ''}`,
    'Aparelhos:', ...(devs.length ? devs : ['  (nenhum carregado)']),
    'Últimos eventos:', ...logRing.slice(-40).map(l => '  ' + l),
  ].join('\n');
}

// ---------- IPC ----------
const SETTABLE = ['theme', 'autostart', 'startHidden', 'closeToTray', 'notifyComfort', 'notifyWasher', 'notifyTimer', 'notifyFilter',
  'forgotHours', 'tariff', 'pollSec', 'hotkeys', 'hotkeyDevice', 'budget', 'nightTemp', 'nightOff'];
ipcMain.handle('settings:get', () => publicSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  const c = getConfig();
  for (const k of SETTABLE) if (k in patch) c[k] = patch[k];
  c.nightTemp = Math.min(30, Math.max(16, Number(c.nightTemp) || 23));
  c.forgotHours = Math.min(48, Math.max(0, Number(c.forgotHours) || 0));
  if (!/^\d\d:\d\d$/.test(c.nightOff)) c.nightOff = '';
  if ('budget' in patch) delete c.budgetNotified;
  saveConfig(c);
  if ('theme' in patch) applyTheme(c.theme);
  if ('autostart' in patch || 'startHidden' in patch) applyAutostart(c);
  if ('hotkeys' in patch) registerHotkeys();
  if (mini && !mini.isDestroyed()) mini.webContents.send('settings');
  return publicSettings();
});
ipcMain.handle('token:set', (_e, token) => saveToken(token));
ipcMain.handle('token:paste', () => saveToken(clipboard.readText()));
ipcMain.handle('auth:clear', () => {
  const c = getConfig();
  delete c.token; delete c.tokenSavedAt;
  if (c.oauth) { delete c.oauth.refresh; delete c.oauth.access; }
  saveConfig(c);
  resetSession();
  try { fs.unlinkSync(cacheFile()); } catch { /* já não existia */ }
  updateTray();
});
ipcMain.handle('oauth:start', async (_e, { clientId, clientSecret, redirectUri, how, code }) => {
  const c = getConfig();
  const o = { ...(c.oauth || {}) };
  if (clientId) o.clientId = clientId;
  if (clientSecret) o.secret = enc(clientSecret);
  if (redirectUri) o.redirectUri = redirectUri;
  try { if (new URL(o.redirectUri).protocol !== 'https:') throw 0; } catch { return { ok: false, error: 'BAD_REDIRECT' }; }
  if (!o.clientId || !o.secret) return { ok: false, error: 'MISSING' };
  c.oauth = o;
  saveConfig(c);
  if (how === 'browser') { shell.openExternal(authorizeUrl(o)); return { ok: true, pending: true }; }
  const r = how === 'code' ? await exchangeCode(code) : await oauthWindow();
  if (r.ok) { const f = getConfig(); delete f.token; delete f.tokenSavedAt; saveConfig(f); resetSession(); logLine('oauth', 'login concluído'); }
  return r;
});

// ---------- atualização automática (GitHub Releases) ----------
let updater = null, updateState = { status: 'idle' };
function setUpdate(u) { updateState = u; for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update', u); }
function initUpdater() {
  if (!app.isPackaged || updater) return;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch (e) { logLine('update', 'módulo ausente: ' + e.message); return; }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.on('update-available', i => setUpdate({ status: 'available', version: i.version }));
  updater.on('update-not-available', () => setUpdate({ status: 'idle' }));
  updater.on('download-progress', p => setUpdate({ status: 'downloading', version: updateState.version, percent: Math.round(p.percent) }));
  updater.on('update-downloaded', i => { setUpdate({ status: 'ready', version: i.version }); });
  updater.on('error', e => {
    logLine('update', e?.message || 'erro');
    setUpdate(updateState.status === 'downloading' ? { status: 'available', version: updateState.version, error: 'O download falhou. Tente de novo.' } : { status: 'idle', error: 'Não consegui verificar agora.' });
  });
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 15000);
  setInterval(check, 6 * 3600000);
}
ipcMain.handle('update:get', () => updateState);
ipcMain.handle('update:check', async () => { initUpdater(); if (!updater) return { dev: true }; try { await updater.checkForUpdates(); } catch { /* o evento de erro já registrou */ } return updateState; });
ipcMain.handle('update:install', async () => {
  if (!updater) return false;
  if (updateState.status === 'ready') { quitting = true; updater.quitAndInstall(false, true); return true; }
  if (updateState.status === 'available') { setUpdate({ status: 'downloading', version: updateState.version, percent: 0 }); updater.downloadUpdate().catch(() => {}); }
  return true;
});
ipcMain.handle('open:external', (_e, url) => {
  if (/^https:\/\/(account\.smartthings\.com|developer\.smartthings\.com|blog\.smartthings\.com|open-meteo\.com|github\.com\/thiagoawks\/clima)(\/|$)/.test(url)) shell.openExternal(url);
});
ipcMain.handle('data:load', () => loadAll());
ipcMain.handle('data:cached', () => (hasAuth() ? readJson(cacheFile(), null) : null));
ipcMain.handle('device:command', async (e, { id, commands }) => {
  await sendCommands(id, commands);
  if (e.sender !== win?.webContents) refreshSoon(2000);
  return true;
});
ipcMain.handle('timer:set', (_e, { id, minutes }) => setTimer(id, minutes));
const MODES = ['cool', 'heat', 'dry', 'wind', 'auto'];
const clampTemp = v => Math.min(30, Math.max(16, Number(v) || 23));
ipcMain.handle('schedules:set', (_e, list) => {
  const c = getConfig();
  c.schedules = (Array.isArray(list) ? list : []).slice(0, 30).map(s => ({
    id: String(s.id || Date.now()), time: /^\d\d:\d\d$/.test(s.time) ? s.time : '22:00',
    deviceId: String(s.deviceId || 'all'), action: s.action === 'off' ? 'off' : 'on',
    mode: MODES.includes(s.mode) ? s.mode : 'cool', setpoint: clampTemp(s.setpoint),
    days: (s.days || []).map(Number).filter(d => d >= 0 && d <= 6), precool: !!s.precool,
    enabled: s.enabled !== false, lastRun: s.lastRun || null,
  }));
  saveConfig(c);
  return c.schedules;
});
ipcMain.handle('scenes:set', (_e, list) => {
  const c = getConfig();
  c.scenes = (Array.isArray(list) ? list : []).slice(0, 12).map(s => ({
    id: String(s.id || Date.now()), name: String(s.name || 'Cena').trim().slice(0, 24) || 'Cena',
    deviceId: String(s.deviceId || 'all'), action: s.action === 'off' ? 'off' : 'on',
    mode: MODES.includes(s.mode) ? s.mode : 'cool', setpoint: clampTemp(s.setpoint),
    special: ['windFree', 'windFreeSleep', 'sleep', 'quiet', 'speed', 'smart'].includes(s.special) ? s.special : null,
  }));
  saveConfig(c);
  updateTray();
  return c.scenes;
});
ipcMain.handle('scene:run', (_e, id) => runScene(String(id)));
ipcMain.handle('night:run', (_e, id) => runNight(String(id)));
ipcMain.handle('wash:dismiss', (_e, id) => { delete washDone[id]; if (lastResult?.washDone) delete lastResult.washDone[id]; return true; });
ipcMain.handle('auto:set', (_e, { id, on }) => {
  const c = getConfig();
  if (on) c.auto[id] = true; else { delete c.auto[id]; delete c.autoStarted[id]; }
  saveConfig(c);
  delete autoPause[id];
  return c.auto;
});
ipcMain.handle('energy:export', () => exportEnergy());
ipcMain.handle('diag:copy', () => { clipboard.writeText(diagText()); return true; });
ipcMain.handle('news:seen', () => { const c = getConfig(); c.lastSeenVersion = app.getVersion(); saveConfig(c); return true; });
ipcMain.handle('mini:set', (_e, on) => setMini(!!on));
ipcMain.handle('win:show', () => showWindow());
ipcMain.handle('win:minimize', () => win?.minimize());
ipcMain.handle('win:maximize', () => (win?.isMaximized() ? win.unmaximize() : win?.maximize()));
ipcMain.handle('win:close', e => (e.sender === mini?.webContents ? setMini(false) : win?.close()));

// ---------- janela ----------
function createWindow(startHidden) {
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1180, height: 850, minWidth: 980, minHeight: 720,
    frame: false, show: false, icon: ICON, title: 'Clima',
    backgroundColor: dark ? '#000000' : '#F5F5F7',
    webPreferences: { preload: PRELOAD, contextIsolation: true, sandbox: true, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.webContents.once('did-finish-load', () => win?.webContents.send('visible', winVisible()));
  win.on('maximize', () => win.webContents.send('maximized', true));
  win.on('unmaximize', () => win.webContents.send('maximized', false));
  // a janela para de consultar a Samsung quando não está na tela
  for (const ev of ['show', 'hide', 'minimize', 'restore']) win.on(ev, () => win?.webContents.send('visible', winVisible()));
  win.on('close', e => {
    if (quitting || !getConfig().closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!trayHintShown) {
      trayHintShown = true;
      notify('O Clima continua rodando', 'Ele fica na bandeja, perto do relógio, cuidando dos avisos, timers e agendamentos.');
    }
  });
  win.on('closed', () => { win = null; if (!quitting) { quitting = true; app.quit(); } });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    if (process.platform === 'win32') app.setAppUserModelId('com.clima.casa');
    trimLog();
    stats = readJson(statsFile(), stats);
    if (stats.month !== monthKey()) stats = { month: monthKey(), n: 0 };
    if (!fs.existsSync(configFile())) saveConfig({ lastSeenVersion: app.getVersion() }); // instalação nova: sem tela de novidades
    const c = getConfig();
    logLine('app', `iniciou ${app.getVersion()}`);
    applyTheme(c.theme);
    const hidden = process.argv.includes('--hidden') || c.startHidden;
    createWindow(hidden);
    createTray();
    const cached = readJson(cacheFile(), null);
    if (cached?.devices) { lastDevices = cached.devices; updateTray(); }
    registerHotkeys();
    initUpdater();
    if (c.mini) createMini();
    setInterval(tick, 30000);
    setTimeout(tick, 8000);
  });
  app.on('before-quit', () => { quitting = true; flushStats(); });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {});
}
if (process.env.CLIMA_TEST) module.exports = { __tick: tick, __auto: autoComfort, __afterLoad: afterLoad, __recordEnergy: recordEnergy, __energyFor: energyFor, __reminders: washerReminders, __state: () => ({ washDone, lastDevices }) };
