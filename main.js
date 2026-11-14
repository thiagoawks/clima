// Processo principal: janela, bandeja, login, API do SmartThings, clima e automações.
const { app, BrowserWindow, ipcMain, safeStorage, shell, Tray, Menu, nativeImage, nativeTheme, Notification, globalShortcut, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { comfort } = require('./shared/comfort');

const API = 'https://api.smartthings.com/v1';
const OAUTH_AUTH = 'https://api.smartthings.com/oauth/authorize';
const OAUTH_TOKEN = 'https://api.smartthings.com/oauth/token';
const SCOPES = 'r:devices:* x:devices:* r:locations:*';
const ICON = path.join(__dirname, 'assets', process.platform === 'win32' ? 'icon.ico' : 'icon.png');
const PRELOAD = path.join(__dirname, 'preload.js');
const dataDir = () => app.getPath('userData');
const configFile = () => path.join(dataDir(), 'config.json');
const energyFile = () => path.join(dataDir(), 'energy.json');
const climateFile = () => path.join(dataDir(), 'climate.json');
const cacheFile = () => path.join(dataDir(), 'cache.json');

const DEFAULTS = {
  theme: 'system', autostart: false, startHidden: false, closeToTray: true,
  notifyComfort: true, notifyWasher: true, notifyTimer: true, tariff: 0.85, pollSec: 20, timers: {},
  schedules: [], auto: {}, autoStarted: {}, hotkeys: true, hotkeyDevice: null, budget: 0, mini: false,
};

let win = null;
let mini = null;
let toast = null;
let tray = null;
let quitting = false;
let lastDevices = [];
let lastLoadAt = 0;
let trayHintShown = false;

// ---------- arquivos ----------
function readJson(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return fallback; }
}
function writeJson(file, obj) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj));
}
function getConfig() { return { ...DEFAULTS, ...readJson(configFile(), {}) }; }
function saveConfig(c) { writeJson(configFile(), c); }
function hasAuth(c = getConfig()) { return !!(c.oauth?.refresh || c.token); }
function publicSettings() {
  const { token, oauth, autoStarted, budgetNotified, ...rest } = getConfig();
  return {
    ...rest, hasToken: !!(oauth?.refresh || token), authMode: oauth?.refresh ? 'oauth' : token ? 'pat' : null,
    oauthClientId: oauth?.clientId || '', oauthRedirect: oauth?.redirectUri || 'https://localhost/clima',
    oauthHasSecret: !!oauth?.secret, version: app.getVersion(),
  };
}
function notify(title, body) {
  if (Notification.isSupported()) new Notification({ title, body, icon: ICON }).show();
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

// ---------- login OAuth (renova sozinho) ----------
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
  if (!r.ok) throw new Error(r.status === 400 || r.status === 401 ? 'OAUTH_REJECTED' : `HTTP ${r.status}`);
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
  const r = await fetch(API + p, { ...opts, headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' } });
  if (r.status === 401 && retry && getConfig().oauth?.refresh) {
    await refreshOAuth();
    return st(p, opts, false);
  }
  if (r.status === 401 || r.status === 403) throw new Error('TOKEN_INVALID');
  if (!r.ok) throw new Error(`HTTP ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return r.status === 204 ? null : r.json();
}
const cmd = (capability, command, args = []) => ({ component: 'main', capability, command, arguments: args });
const sendCommands = (id, commands) => st(`/devices/${id}/commands`, { method: 'POST', body: JSON.stringify({ commands }) });
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
    id: dev.deviceId, kind: 'ac', name: dev.label || dev.name,
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
    id: dev.deviceId, kind: 'washer', name: dev.label || dev.name,
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

function recordEnergy(ac) {
  if (ac.energy == null) return;
  const store = readJson(energyFile(), { last: {}, days: {} });
  const now = new Date();
  const last = store.last[ac.id];
  if (last && ac.energy >= last.e && ac.energy - last.e < 20000) {
    const day = dayKey(now);
    store.days[day] ||= {};
    store.days[day][ac.id] ||= Array(24).fill(0);
    store.days[day][ac.id][now.getHours()] += ac.energy - last.e;
  }
  store.last[ac.id] = { e: ac.energy, t: now.toISOString() };
  store.days = trimDays(store.days, 35);
  writeJson(energyFile(), store);
}
function energyFor(id) {
  const store = readJson(energyFile(), { days: {} });
  const sum = a => (a ? a.reduce((x, y) => x + y, 0) : 0);
  const y = new Date(); y.setDate(y.getDate() - 1);
  const week = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i);
    week.push({ date: dayKey(d), wh: sum(store.days[dayKey(d)]?.[id]) });
  }
  let month = 0;
  const prefix = dayKey().slice(0, 7);
  for (const [k, v] of Object.entries(store.days)) if (k.startsWith(prefix)) month += sum(v[id]);
  return { hours: store.days[dayKey()]?.[id] || Array(24).fill(0), yHours: store.days[dayKey(y)]?.[id] || null, week, month };
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
    locCache = { id: locationId, name: 'Casa', lat: null, lon: null };
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
async function loadAll() {
  const list = (await st('/devices')).items || [];
  const devices = [];
  const weatherP = (list[0]?.locationId ? getLocation(list[0].locationId) : Promise.resolve({ name: 'Casa', lat: -23.55, lon: -46.63 }))
    .then(async loc => ({ loc, weather: await getWeather(loc) }));
  await Promise.all(list.map(async dev => {
    const caps = (dev.components?.[0]?.capabilities || []).map(c => c.id);
    const isAc = caps.includes('airConditionerMode');
    const isWasher = caps.includes('washerOperatingState');
    if (!isAc && !isWasher) return;
    try {
      const s = await st(`/devices/${dev.deviceId}/status`);
      const main = s.components?.main;
      if (isAc) {
        const ac = mapAc(dev, main);
        recordEnergy(ac);
        ac.history = energyFor(ac.id);
        devices.push(ac);
      } else devices.push(mapWasher(dev, main));
    } catch (e) {
      if (e.message === 'TOKEN_INVALID') throw e;
      devices.push({ id: dev.deviceId, kind: isAc ? 'ac' : 'washer', name: dev.label || dev.name, offline: true });
    }
  }));
  devices.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === 'ac' ? -1 : 1));
  const acs = devices.filter(d => d.kind === 'ac' && !d.offline);
  recordClimate(acs);
  lastDevices = devices;
  lastLoadAt = Date.now();
  updateTray();
  const { loc, weather } = await weatherP;
  const monthWh = acs.reduce((s, d) => s + (d.history?.month || 0), 0);
  checkBudget(monthWh);
  const result = { devices, location: loc.name, weather, timers: getConfig().timers, monthWh, at: Date.now() };
  writeJson(cacheFile(), result);
  if (mini && !mini.isDestroyed()) mini.webContents.send('data', result);
  return result;
}
async function ensureFresh(maxAgeMs = 90000) {
  if (!hasAuth() || Date.now() - lastLoadAt < maxAgeMs) return;
  try { await loadAll(); } catch { /* tenta de novo na próxima volta */ }
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
      if (c.notifyTimer) notify(`${nameOf(id)} desligado`, 'O timer terminou.');
    } catch { c.timers[id] = Date.now() + 60000; }
  }
  lastLoadAt = 0;
  const fresh = getConfig(); fresh.timers = c.timers; saveConfig(fresh);
  win?.webContents.send('refresh');
}

// ---------- agendamentos (com pré-resfriar) ----------
function scheduleTargets(s) {
  const acs = lastDevices.filter(d => d.kind === 'ac' && !d.offline);
  return s.deviceId === 'all' ? acs : acs.filter(d => d.id === s.deviceId);
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
    for (const d of targets) {
      try { await sendCommands(d.id, s.action === 'off' ? [cmd('switch', 'off')] : onCommands(s)); } catch { /* segue para o próximo */ }
    }
    const who = s.deviceId === 'all' ? 'Todos os ares' : nameOf(s.deviceId);
    notify(`Agendamento das ${s.time}`, s.action === 'off' ? `${who}: desligado.` : `${who}: ligado${early > 0 ? ` ${early} min antes, para chegar em ${s.setpoint}° no horário` : ''}.`);
  }
  if (changed) {
    lastLoadAt = 0; // o estado mudou: quem vier depois busca de novo
    const fresh = getConfig(); fresh.schedules = c.schedules; saveConfig(fresh);
    setTimeout(() => win?.webContents.send('refresh'), 2000);
  }
}

// ---------- conforto automático ----------
const autoLast = {};   // último comando automático por aparelho
const autoPause = {};  // pausa depois que a pessoa desliga na mão
async function autoComfort() {
  const c = getConfig();
  const ids = Object.keys(c.auto).filter(id => c.auto[id]);
  if (!ids.length) return;
  await ensureFresh(); // nunca decide com dado velho
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
        notify(`${shortName(d.name)}: ar ligado sozinho`, `Estava ${cf.label.toLowerCase()} (${cf.why}). ${cf.action.text.replace('Ligar', 'Ligado')}.`);
      } catch { /* tenta na próxima */ }
    } else if (d.on && c.autoStarted[id] && cf?.level === 'ok') {
      const out = weatherCache.data?.current?.apparent_temperature;
      if (out != null && out <= 22) {
        try {
          await sendCommands(id, [cmd('switch', 'off')]);
          autoLast[id] = Date.now(); delete c.autoStarted[id]; changed = true;
          notify(`${shortName(d.name)}: ar desligado sozinho`, `O quarto está confortável e lá fora está ${Math.round(out)}°.`);
        } catch { /* tenta na próxima */ }
      }
    }
  }
  if (changed) {
    const fresh = getConfig(); fresh.autoStarted = c.autoStarted; saveConfig(fresh);
    setTimeout(() => win?.webContents.send('refresh'), 2000);
  }
}

// ---------- volta periódica ----------
let tickCount = 0;
let ticking = false;
async function tick() {
  if (ticking || !hasAuth()) return;
  ticking = true;
  try {
    const c = getConfig();
    // renova o login com folga, para o refresh token nunca ficar parado
    if (c.oauth?.refresh && c.oauth.expiresAt - Date.now() < 6 * 3600000) await refreshOAuth().catch(() => {});
    await checkTimers();
    await ensureFresh();
    await checkSchedules();
    if (tickCount++ % 4 === 0) await autoComfort();
  } catch { /* próxima volta */ }
  ticking = false;
}

// ---------- atalhos globais e aviso na tela ----------
function hotkeyDevice() {
  const acs = lastDevices.filter(d => d.kind === 'ac' && !d.offline);
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
function hotkeySetpoint(dir) {
  const d = hotkeyDevice();
  if (!d) return showToast('Nenhum ar encontrado');
  if (!d.on) return showToast(`${shortName(d.name)} está desligado`);
  d.setpoint = Math.min(d.max, Math.max(d.min, (d.setpoint ?? 24) + dir));
  showToast(`${shortName(d.name)} · ${d.setpoint}°`);
  clearTimeout(hotkeyTimer);
  hotkeyTimer = setTimeout(async () => {
    try { await sendCommands(d.id, [cmd('thermostatCoolingSetpoint', 'setCoolingSetpoint', [d.setpoint])]); } catch { showToast('Não consegui enviar o comando'); }
    setTimeout(() => win?.webContents.send('refresh'), 1500);
  }, 600);
}
async function hotkeyPower() {
  const d = hotkeyDevice();
  if (!d) return showToast('Nenhum ar encontrado');
  d.on = !d.on;
  showToast(`${shortName(d.name)} · ${d.on ? 'ligado' : 'desligado'}`);
  try { await sendCommands(d.id, [cmd('switch', d.on ? 'on' : 'off')]); } catch { showToast('Não consegui enviar o comando'); }
  setTimeout(() => win?.webContents.send('refresh'), 1500);
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
  const acs = lastDevices.filter(d => d.kind === 'ac' && !d.offline);
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
        ] : []),
      ],
    });
  }
  if (acs.some(a => a.on)) items.push({ label: 'Desligar todos os ares', click: () => acs.filter(a => a.on).forEach(a => quick(a.id, [cmd('switch', 'off')])) });
  if (washer) {
    const running = washer.state === 'running';
    items.push({ label: `${washer.name}: ${running ? `termina em ${washer.remaining ?? '?'} min` : 'parada'}`, enabled: false });
  }
  items.push({ type: 'separator' },
    { label: 'Mini janela', type: 'checkbox', checked: !!getConfig().mini, click: m => setMini(m.checked) },
    { label: 'Sair', click: () => { quitting = true; app.quit(); } });
  tray.setContextMenu(Menu.buildFromTemplate(items));
  const on = acs.filter(a => a.on).length;
  tray.setToolTip(acs.length ? `Clima: ${on} de ${acs.length} ares ligados` : 'Clima');
}
async function quick(id, commands) {
  try { await sendCommands(id, commands); } catch { /* a janela mostra o erro na próxima atualização */ }
  setTimeout(() => win?.webContents.send('refresh'), 1500);
}
function createTray() {
  tray = new Tray(nativeImage.createFromPath(ICON));
  tray.on('click', showWindow);
  updateTray();
}

// ---------- IPC ----------
ipcMain.handle('settings:get', () => publicSettings());
ipcMain.handle('settings:set', (_e, patch) => {
  const allowed = ['theme', 'autostart', 'startHidden', 'closeToTray', 'notifyComfort', 'notifyWasher', 'notifyTimer', 'tariff', 'pollSec', 'hotkeys', 'hotkeyDevice', 'budget'];
  const c = getConfig();
  for (const k of allowed) if (k in patch) c[k] = patch[k];
  if ('budget' in patch) delete c.budgetNotified;
  saveConfig(c);
  if ('theme' in patch) applyTheme(c.theme);
  if ('autostart' in patch || 'startHidden' in patch) applyAutostart(c);
  if ('hotkeys' in patch) registerHotkeys();
  if (mini && !mini.isDestroyed()) mini.webContents.send('settings');
  return publicSettings();
});
ipcMain.handle('token:set', async (_e, token) => {
  const c = getConfig();
  c.token = enc(String(token).trim());
  if (c.oauth) { delete c.oauth.refresh; delete c.oauth.access; }
  saveConfig(c);
  try { await st('/devices'); return { ok: true }; }
  catch (e) { return { ok: false, error: e.message }; }
});
ipcMain.handle('auth:clear', () => {
  const c = getConfig();
  delete c.token;
  if (c.oauth) { delete c.oauth.refresh; delete c.oauth.access; }
  saveConfig(c);
  lastDevices = []; lastLoadAt = 0;
  try { fs.unlinkSync(cacheFile()); } catch {}
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
  if (r.ok) { const f = getConfig(); delete f.token; saveConfig(f); }
  return r;
});
// Cria o app OAuth sozinho, usando um token temporário só durante esta chamada (não é salvo).
ipcMain.handle('oauth:autosetup', async (_e, { token, redirectUri }) => {
  const redirect = redirectUri || 'https://localhost/clima';
  try { if (new URL(redirect).protocol !== 'https:') throw 0; } catch { return { ok: false, error: 'BAD_REDIRECT' }; }
  const pat = String(token || '').trim();
  if (!pat) return { ok: false, error: 'NO_PAT' };
  const call = async (method, p, body) => {
    const r = await fetch(API + p, { method, headers: { Authorization: 'Bearer ' + pat, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    const text = await r.text();
    let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, ok: r.ok, json, text };
  };
  const scope = SCOPES.split(' ');
  try {
    const created = await call('POST', '/apps', {
      appName: 'clima-' + require('crypto').randomBytes(4).toString('hex'),
      displayName: 'Clima', description: 'Controle dos meus eletrodomésticos no Windows',
      singleInstance: true, appType: 'API_ONLY', classifications: ['CONNECTED_SERVICE'], apiOnly: {},
      oauth: { clientName: 'Clima', scope, redirectUris: [redirect] },
    });
    if (created.status === 401 || created.status === 403) return { ok: false, error: 'PAT_DENIED', detail: created.text.slice(0, 200) };
    if (!created.ok) return { ok: false, error: 'CREATE_FAILED', detail: created.text.slice(0, 300) };
    const appId = created.json?.app?.appId;
    let clientId = created.json?.oauthClientId, secret = created.json?.oauthClientSecret;
    if (appId && (!clientId || !secret)) {
      await call('PUT', `/apps/${appId}/oauth`, { clientName: 'Clima', scope, redirectUris: [redirect] });
      const g = await call('POST', `/apps/${appId}/oauth/generate`, { clientName: 'Clima', scope, redirectUris: [redirect] });
      clientId = g.json?.oauthClientId; secret = g.json?.oauthClientSecret;
    }
    if (!clientId || !secret) return { ok: false, error: 'CREATE_FAILED', detail: 'A Samsung não devolveu as credenciais.' };
    // bug conhecido da Samsung: às vezes o scope com * volta corrompido. Regrava uma vez.
    if (appId) {
      const chk = await call('GET', `/apps/${appId}/oauth`);
      if (JSON.stringify(chk.json?.scope || []).includes('$')) await call('PUT', `/apps/${appId}/oauth`, { clientName: 'Clima', scope, redirectUris: [redirect] });
    }
    const c = getConfig();
    c.oauth = { ...(c.oauth || {}), clientId, secret: enc(secret), redirectUri: redirect, appId };
    saveConfig(c);
    const r = await oauthWindow();
    if (r.ok) { const f = getConfig(); delete f.token; saveConfig(f); }
    return r;
  } catch (e) { return { ok: false, error: 'NETWORK', detail: e.message }; }
});
// ---------- atualização automática (GitHub Releases) ----------
let updater = null, updateState = { status: 'idle' };
function setUpdate(u) { updateState = u; for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send('update', u); }
function initUpdater() {
  if (!app.isPackaged || updater) return;
  try {
    updater = require('electron-updater').autoUpdater;
  } catch { return; }
  updater.autoDownload = false;
  updater.autoInstallOnAppQuit = false;
  updater.on('update-available', i => setUpdate({ status: 'available', version: i.version }));
  updater.on('update-not-available', () => setUpdate({ status: 'idle' }));
  updater.on('download-progress', p => setUpdate({ status: 'downloading', version: updateState.version, percent: Math.round(p.percent) }));
  updater.on('update-downloaded', i => { setUpdate({ status: 'ready', version: i.version }); });
  updater.on('error', () => setUpdate(updateState.status === 'downloading' ? { status: 'available', version: updateState.version, error: true } : { status: 'idle' }));
  const check = () => updater.checkForUpdates().catch(() => {});
  setTimeout(check, 15000);
  setInterval(check, 6 * 3600000);
}
ipcMain.handle('update:get', () => updateState);
ipcMain.handle('update:check', async () => { initUpdater(); if (!updater) return { dev: true }; try { await updater.checkForUpdates(); } catch {} return updateState; });
ipcMain.handle('update:install', async () => {
  if (!updater) return false;
  if (updateState.status === 'ready') { quitting = true; updater.quitAndInstall(false, true); return true; }
  if (updateState.status === 'available') { setUpdate({ status: 'downloading', version: updateState.version, percent: 0 }); updater.downloadUpdate().catch(() => {}); }
  return true;
});
ipcMain.handle('open:external', (_e, url) => {
  if (/^https:\/\/(account\.smartthings\.com|developer\.smartthings\.com|open-meteo\.com)\//.test(url)) shell.openExternal(url);
});
ipcMain.handle('data:load', () => loadAll());
ipcMain.handle('data:cached', () => (hasAuth() ? readJson(cacheFile(), null) : null));
ipcMain.handle('device:command', async (e, { id, commands }) => {
  await sendCommands(id, commands);
  if (e.sender !== win?.webContents) setTimeout(() => win?.webContents.send('refresh'), 2000);
  return true;
});
ipcMain.handle('timer:set', (_e, { id, minutes }) => setTimer(id, minutes));
ipcMain.handle('schedules:set', (_e, list) => {
  const c = getConfig();
  c.schedules = (Array.isArray(list) ? list : []).slice(0, 30).map(s => ({
    id: String(s.id || Date.now()), time: /^\d\d:\d\d$/.test(s.time) ? s.time : '22:00',
    deviceId: String(s.deviceId || 'all'), action: s.action === 'off' ? 'off' : 'on',
    mode: ['cool', 'heat', 'dry', 'wind', 'auto'].includes(s.mode) ? s.mode : 'cool',
    setpoint: Math.min(30, Math.max(16, Number(s.setpoint) || 23)),
    days: (s.days || []).map(Number).filter(d => d >= 0 && d <= 6), precool: !!s.precool,
    enabled: s.enabled !== false, lastRun: s.lastRun || null,
  }));
  saveConfig(c);
  return c.schedules;
});
ipcMain.handle('auto:set', (_e, { id, on }) => {
  const c = getConfig();
  if (on) c.auto[id] = true; else { delete c.auto[id]; delete c.autoStarted[id]; }
  saveConfig(c);
  delete autoPause[id];
  return c.auto;
});
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
  win.on('maximize', () => win.webContents.send('maximized', true));
  win.on('unmaximize', () => win.webContents.send('maximized', false));
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
    const c = getConfig();
    applyTheme(c.theme);
    createWindow(process.argv.includes('--hidden') || c.startHidden);
    createTray();
    const cached = readJson(cacheFile(), null);
    if (cached?.devices) { lastDevices = cached.devices; updateTray(); }
    registerHotkeys();
    initUpdater();
    if (c.mini) createMini();
    setInterval(tick, 30000);
    setTimeout(tick, 8000);
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('will-quit', () => globalShortcut.unregisterAll());
  app.on('window-all-closed', () => {});
}
if (process.env.CLIMA_TEST) module.exports = { __tick: tick, __auto: autoComfort };
