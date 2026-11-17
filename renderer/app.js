// Interface do Clima: desenha as telas e conversa com o processo principal.
const $ = s => document.querySelector(s);
const appEl = $('#app');

// ---------- textos ----------
const L = {
  modes: { cool: 'Frio', heat: 'Quente', auto: 'Auto', wind: 'Vento', dry: 'Seco' },
  modeSub: { cool: 'Resfriando', heat: 'Aquecendo', auto: 'Automático', wind: 'Ventilando', dry: 'Desumidificando' },
  fans: { auto: 'Auto', low: 'Baixo', medium: 'Médio', high: 'Alto', turbo: 'Turbo' },
  oscs: { fixed: 'Fixa', vertical: 'Vertical', horizontal: 'Horizontal', all: 'Todas' },
  specials: { off: 'Nenhum', sleep: 'Sono', quiet: 'Silencioso', smart: 'Smart', speed: 'Rápido', windFree: 'WindFree', windFreeSleep: 'WindFree Sono' },
  jobs: { none: 'Parada', wash: 'Lavando', rinse: 'Enxaguando', spin: 'Centrifugando', weightSensing: 'Pesando a roupa',
    delayWash: 'Agendada', finish: 'Finalizada', airWash: 'Lavagem a ar', drying: 'Secando', wrinklePrevent: 'Anti-rugas', aIRinse: 'Enxaguando', aISpin: 'Centrifugando' },
  phases: { wash: 'Lavagem', rinse: 'Enxágue', spin: 'Centrifugação' },
  spin: { rinseHold: 'segurar enxágue', extraLow: 'extra baixa', low: 'baixa', medium: 'média', high: 'alta', extraHigh: 'extra alta' },
  order: { modes: ['cool', 'heat', 'auto', 'wind', 'dry'], fans: ['auto', 'low', 'medium', 'high', 'turbo'] },
};
const WMO = c => c === 0 ? 'Céu limpo' : c <= 2 ? 'Poucas nuvens' : c === 3 ? 'Nublado' : c <= 48 ? 'Neblina'
  : c <= 57 ? 'Garoa' : c <= 67 ? 'Chuva' : c <= 77 ? 'Neve' : c <= 82 ? 'Pancadas de chuva' : 'Tempestade';
const DAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const TIMERS = [[30, '30 min'], [60, '1 hora'], [120, '2 horas'], [240, '4 horas'], [480, '8 horas']];

const ICON = {
  snow: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 1.5v15M2.5 5.25l13 7.5M2.5 12.75l13-7.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  wind: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M2 7h9a2.5 2.5 0 10-2.5-2.5M2 11h12a2.5 2.5 0 11-2.5 2.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  sun: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><circle cx="9" cy="9" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M9 1v2M9 15v2M1 9h2M15 9h2M3.3 3.3l1.4 1.4M13.3 13.3l1.4 1.4M3.3 14.7l1.4-1.4M13.3 4.7l1.4-1.4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  drop: '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2s5 5.5 5 9a5 5 0 01-10 0c0-3.5 5-9 5-9z" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>',
  dropSm: '<svg width="10" height="10" viewBox="0 0 18 18" aria-hidden="true"><path d="M9 2s5 5.5 5 9a5 5 0 01-10 0c0-3.5 5-9 5-9z" fill="currentColor"/></svg>',
  washer: '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><rect x="3" y="2" width="14" height="16" rx="3" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="11" r="4" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="6.5" cy="5" r=".9" fill="currentColor"/></svg>',
  therm: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M6 2.5a2 2 0 014 0v6.3a3.5 3.5 0 11-4 0z" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="11.5" r="1.6" fill="currentColor"/></svg>',
  bulb: '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 11.5h5M6.5 14h3M8 1.5a4.5 4.5 0 00-2.6 8.2c.4.3.6.7.6 1.2v.6h4v-.6c0-.5.2-.9.6-1.2A4.5 4.5 0 008 1.5z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  x: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  back: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M8.5 3L4.5 7l4 4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  check: '<svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true"><path d="M3 7.5l2.5 2.5L11 4.5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  maxOn: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2" y="4" width="6" height="6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4"/><path d="M4.5 2h4A1.5 1.5 0 0110 3.5v4" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  maxOff: '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><rect x="2.5" y="2.5" width="7" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>',
};
const modeIcon = m => m === 'heat' ? ICON.sun : m === 'wind' ? ICON.wind : m === 'dry' ? ICON.drop : ICON.snow;

// ---------- formatação ----------
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const deg = v => v == null ? '—' : `${Math.round(v)}°`;
const fmt1 = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
const kwh = wh => (wh / 1000).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const brl = v => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const hhmm = d => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
const shortName = n => String(n || '').replace(/^ar[\s-]*condicionado\s*/i, '').trim() || n;
const isNight = () => { const h = new Date().getHours(); return h >= 22 || h < 6; };

// Uma dica por vez, cruzando o quarto, o clima lá fora e a previsão.
function insight(d) {
  const w = S.data?.weather;
  const out = w?.current?.temperature_2m;
  const raining = (w?.current?.precipitation ?? 0) > 0;
  const c = comfort(d.temp, d.humidity, d.modes);
  if (!d.on && c?.action && c.level !== 'cold' && out != null && d.temp != null && out <= d.temp - 3 && !raining)
    return `Lá fora está ${deg(out)}, mais fresco que aqui. Abrir a janela também resolve e não gasta energia.`;
  if (d.on && d.mode === 'cool' && c?.level === 'ok' && out != null && out <= 21 && !raining)
    return `Lá fora está ${deg(out)}. Dá pra desligar o ar e abrir a janela.`;
  if (d.on && d.mode === 'cool' && d.setpoint != null && d.setpoint <= 20)
    return `${d.setpoint}° é bem frio. Entre 23° e 24° costuma bastar, e cada grau a mais reduz o consumo.`;
  if (d.on && d.mode === 'cool' && isNight() && d.special === 'off' && d.specials?.includes('windFreeSleep'))
    return 'Pra dormir, o modo WindFree Sono resfria sem vento direto e ajusta a temperatura durante a noite.';
  if (d.filterCapacity && d.filterUsage >= d.filterCapacity * 0.9 || (d.filterStatus && d.filterStatus !== 'normal'))
    return 'O filtro está perto do limite de uso. Vale tirar e lavar com água.';
  const tomorrow = w?.daily?.temperature_2m_max?.[1];
  if (tomorrow != null && tomorrow >= 30) return `Amanhã deve chegar a ${deg(tomorrow)}. Fechar as cortinas cedo ajuda o quarto a esquentar menos.`;
  return null;
}

// ---------- estado ----------
const S = {
  settings: null, data: null, sel: null, view: 'home', demo: false, error: null, updatedAt: null,
  range: 'day', sheet: null, flash: null, visible: true, update: null,
};
let pollTimer = null;
let setpointTimer = null;

function applyTheme() {
  const t = S.settings?.theme || 'system';
  const dark = t === 'dark' || (t === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

// ---------- carregamento ----------
async function start() {
  // abre na hora com os últimos dados salvos e atualiza em seguida
  const [settings, cached] = await Promise.all([window.api.getSettings(), window.api.cached?.() ?? null]);
  S.settings = settings;
  applyTheme();
  if (cached?.devices && settings.hasToken) {
    S.data = cached;
    S.updatedAt = cached.at ? new Date(cached.at) : null;
    S.data.devices.forEach(d => { if (d.kind === 'ac') d.name = shortName(d.name); });
    S.sel = S.data.devices[0]?.id ?? null;
  }
  if (settings.showNews) S.sheet = 'news';
  render();
  if (S.settings.hasToken) {
    await refresh();
    schedulePoll();
  }
}
// só consulta a Samsung com a janela na tela; escondido, quem cuida é o processo principal
function schedulePoll() {
  clearInterval(pollTimer);
  if (S.visible && S.settings?.hasToken && !S.demo) pollTimer = setInterval(refresh, (S.settings?.pollSec || 30) * 1000);
}
const errKind = e => {
  const m = String(e?.message || e);
  return m.includes('TOKEN_INVALID') || m.includes('NO_TOKEN') ? 'token' : m.includes('FORBIDDEN') ? 'forbidden' : m.includes('RATE_LIMIT') ? 'rate' : null;
};
// não redesenha por baixo de quem está digitando nas configurações ou numa folha aberta
const softRender = () => { if (S.view !== 'settings' && !S.sheet) render(); };
async function refresh() {
  if (S.demo || !S.settings?.hasToken) return render();
  try {
    S.data = await window.api.load();
    S.error = null;
    S.updatedAt = new Date();
  } catch (e) {
    S.error = errKind(e) || 'net';
  }
  S.data?.devices.forEach(d => { if (d.kind === 'ac') d.name = shortName(d.name); });
  if (S.data && !S.data.devices.find(d => d.id === S.sel)) S.sel = S.data.devices[0]?.id ?? null;
  softRender();
}
window.api.onRefresh?.(() => refresh());
window.api.onVisible?.(v => { S.visible = v; schedulePoll(); if (v && S.settings?.hasToken && !S.demo) refresh(); });
window.api.onSettings?.(async () => { S.settings = await window.api.getSettings(); if (S.view !== 'settings') render(); else $('#tb-mini')?.classList.toggle('active', !!S.settings.mini); });

const devices = () => S.data?.devices || [];
const selected = () => devices().find(d => d.id === S.sel);
const timerEnd = id => S.data?.timers?.[id] || null;

function alerts() {
  return devices().filter(d => d.kind === 'ac' && !d.offline && !d.on)
    .map(d => ({ d, c: comfort(d.temp, d.humidity, d.modes) })).filter(x => x.c?.action);
}

// ---------- comandos ----------
const send = (dev, capability, command, args = [], patch = {}) => sendMany(dev, [[capability, command, args]], patch);
async function sendMany(dev, list, patch = {}) {
  Object.assign(dev, patch);
  render();
  if (S.demo) return;
  try {
    await window.api.command({ id: dev.id, commands: list.map(([capability, command, args]) => ({ component: 'main', capability, command, arguments: args })) });
  } catch (e) {
    S.error = errKind(e) || 'cmd';
    render();
  }
  setTimeout(refresh, 2500);
}

async function saveSetting(patch) {
  Object.assign(S.settings, patch);
  if ('theme' in patch) applyTheme();
  if ('pollSec' in patch) schedulePoll();
  setTimeout(render, 0); // fora do evento atual: um campo perdendo o foco não pode redesenhar no meio de outro desenho
  S.settings = { ...S.settings, ...(await window.api.setSettings(patch)) };
}

const actions = {
  select: id => { S.sel = id; render(); },
  power: () => { const d = selected(); send(d, 'switch', d.on ? 'off' : 'on', [], { on: !d.on }); },
  mode: m => send(selected(), 'airConditionerMode', 'setAirConditionerMode', [m], { mode: m }),
  fan: f => send(selected(), 'airConditionerFanMode', 'setFanMode', [f], { fan: f }),
  range: r => { S.range = r; render(); },
  temp: dir => {
    const d = selected();
    d.setpoint = Math.min(d.max, Math.max(d.min, (d.setpoint ?? 24) + Number(dir) * d.step));
    render();
    clearTimeout(setpointTimer);
    setpointTimer = setTimeout(() => send(d, 'thermostatCoolingSetpoint', 'setCoolingSetpoint', [d.setpoint]), 700);
  },
  turnOn: id => {
    const d = devices().find(x => x.id === id);
    const a = comfort(d.temp, d.humidity, d.modes)?.action || { mode: 'cool', setpoint: 24 };
    sendMany(d, [['switch', 'on', []], ['airConditionerMode', 'setAirConditionerMode', [a.mode]],
      ['thermostatCoolingSetpoint', 'setCoolingSetpoint', [a.setpoint]]], { on: true, mode: a.mode, setpoint: a.setpoint });
  },
  washer: st => send(selected(), 'washerOperatingState', 'setMachineState', [st],
    { state: st === 'run' ? 'running' : st === 'pause' ? 'paused' : 'ready' }),
  night: async () => {
    const d = selected();
    Object.assign(d, { on: true, mode: 'cool', setpoint: S.settings.nightTemp || 23 });
    render();
    if (S.demo) return;
    try {
      const r = await window.api.night(d.id);
      Object.assign(d, { setpoint: r.setpoint, ...(r.special ? { special: r.special } : {}) });
      S.data.timers = r.timers;
      flash(`Boa noite: ${d.name} no Frio a ${r.setpoint}°${timerEnd(d.id) ? `, desliga às ${hhmm(new Date(timerEnd(d.id)))}` : ''}`);
    } catch (e) { S.error = errKind(e) || 'cmd'; render(); }
    setTimeout(refresh, 2500);
  },
  scene: async id => {
    if (S.demo) return flash('Na demonstração as cenas não enviam comandos');
    const r = await window.api.runScene(id).catch(() => null);
    flash(!r || !r.total ? 'Não consegui aplicar a cena' : r.ok ? `${r.name}: feito` : `${r.name}: ${r.n} de ${r.total} ares responderam`);
    setTimeout(refresh, 2000);
  },
  sceneAdd: () => {
    const name = $('#cn-name').value.trim();
    if (!name) { $('#cn-name').focus(); return; }
    saveScenes([...(S.settings.scenes || []), { id: String(Date.now()), name, deviceId: $('#cn-dev').value, action: $('#cn-action').value,
      mode: $('#cn-mode').value, setpoint: Number($('#cn-temp').value) || 23 }]);
  },
  sceneDel: id => saveScenes((S.settings.scenes || []).filter(x => x.id !== id)),
  sheet: name => { S.sheet = name; render(); setTimeout(() => $('.sheet button, .sheet input')?.focus(), 30); },
  sheetClose: () => closeSheet(),
  tokenPage: () => window.api.openExternal('https://account.smartthings.com/tokens'),
  tokenPaste: () => connectToken(() => window.api.pasteToken()),
  tokenSave: () => {
    const token = $('#token').value.trim();
    if (!token) { $('#token-msg').textContent = 'Cole o token no campo.'; return; }
    connectToken(() => window.api.setToken(token));
  },
  newsOk: () => { window.api.newsSeen?.(); S.settings.showNews = false; closeSheet(); },
  exportCsv: async () => {
    const el = $('#csv-msg');
    const r = S.demo ? { ok: false, error: 'EMPTY' } : await window.api.exportEnergy();
    el.textContent = r.ok ? `Salvo, com ${r.rows} linhas.` : r.error === 'EMPTY' ? 'Ainda não há consumo anotado.' : '';
  },
  copyDiag: async () => { await window.api.copyDiag(); $('#diag-msg').textContent = 'Copiado. Cole na conversa em que pediu ajuda.'; },
  auto: async () => {
    const d = selected();
    const on = !S.settings.auto?.[d.id];
    S.settings.auto = { ...(S.settings.auto || {}), [d.id]: on };
    render();
    if (!S.demo) S.settings.auto = await window.api.setAuto(d.id, on);
  },
  washDismiss: id => { if (S.data?.washDone) delete S.data.washDone[id]; render(); if (!S.demo) window.api.washDismiss(id); },
  miniToggle: async () => { const on = !S.settings.mini; S.settings.mini = on; render(); await window.api.setMini(on); },
  schedAdd: () => {
    const days = [...document.querySelectorAll('.sc-day:checked')].map(x => Number(x.value));
    if (!days.length || !$('#sc-time').value) return;
    saveSchedules([...(S.settings.schedules || []), {
      id: String(Date.now()), time: $('#sc-time').value, deviceId: $('#sc-dev').value, action: $('#sc-action').value,
      mode: $('#sc-mode').value, setpoint: Number($('#sc-temp').value) || 23, days, precool: $('#sc-pre').checked, enabled: true,
    }]);
  },
  schedDel: id => saveSchedules((S.settings.schedules || []).filter(x => x.id !== id)),
  schedToggle: id => saveSchedules((S.settings.schedules || []).map(x => (x.id === id ? { ...x, enabled: !x.enabled } : x))),
  checkUpdate: async () => {
    const el = $('#upd-status'); if (el) el.textContent = 'Verificando…';
    const r = await window.api.updateCheck();
    if (r?.dev && el) el.textContent = 'Só funciona no app instalado.';
    else { showUpdate(r); if (r?.error && el) el.textContent = r.error; }
  },
  oauthLogin: () => oauth('window'),
  oauthBrowser: () => oauth('browser'),
  oauthCode: () => oauth('code'),
  settings: () => { S.view = S.view === 'settings' ? 'home' : 'settings'; render(); },
  home: () => { S.view = 'home'; render(); },
  demo: () => { S.demo = true; S.data = demoData(); S.sel = S.data.devices[0].id; S.updatedAt = new Date(); render(); },
  connect: () => (S.settings?.authMode === 'oauth' ? actions.account() : actions.sheet('token')),
  account: () => { S.view = 'settings'; S.sheet = null; render(); $('#conta')?.scrollIntoView({ block: 'start' }); },
  retry: refresh,
  set: arg => { const [k, v] = arg.split(':'); saveSetting({ [k]: v === 'true' ? true : v === 'false' ? false : isNaN(v) ? v : Number(v) }); },
  toggleSet: k => saveSetting({ [k]: !S.settings[k] }),
  link: url => window.api.openExternal(url),
  clearToken: async () => {
    await window.api.clearAuth();
    S.settings = await window.api.getSettings();
    S.data = null; S.demo = false;
    clearInterval(pollTimer);
    render();
  },
};

async function afterAuth() {
  S.settings = await window.api.getSettings();
  S.demo = false; S.error = null; S.view = 'home'; S.sheet = null;
  render();
  await refresh(); schedulePoll();
}
const TOKEN_ERR = {
  NOT_A_TOKEN: 'Isso não parece um token. Copie o código inteiro que a Samsung mostra depois de gerar.',
  TOKEN_INVALID: 'A Samsung não aceitou esse token. Gere um novo e copie na hora, ele só aparece uma vez.',
  FORBIDDEN: 'A Samsung recusou o acesso (erro 403). Confira se marcou as permissões de dispositivos.',
  NETWORK: 'Não consegui falar com a Samsung. Confira a internet.',
};
async function connectToken(run) {
  const msg = $('#token-msg');
  msg.textContent = 'Verificando com a Samsung…';
  const r = await run();
  if (!r.ok) { msg.textContent = TOKEN_ERR[r.error] || `A Samsung respondeu com o erro ${r.status || '?'}. Tente de novo em instantes.`; return; }
  await afterAuth();
}
function closeSheet() { S.sheet = null; render(); }
let flashTimer = null;
function flash(text) {
  S.flash = text;
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => { S.flash = null; softRender(); }, 5000);
  softRender();
}
async function saveScenes(list) {
  S.settings.scenes = S.demo ? list : await window.api.setScenes(list);
  render();
}
async function saveSchedules(list) {
  S.settings.schedules = await window.api.setSchedules(list);
  render();
}
const OAUTH_ERR = {
  MISSING: 'Preencha o Client ID e o Client Secret.',
  BAD_REDIRECT: 'A Redirect URI precisa começar com https://.',
  CANCELLED: 'Login cancelado.',
  NO_CODE: 'Cole o endereço completo da página para onde o navegador foi depois do login.',
  OAUTH_REJECTED: 'A Samsung recusou. Confira o Client ID, o Secret e se a Redirect URI é igual à cadastrada.',
};
async function oauth(how) {
  const msg = $('#oauth-msg');
  msg.textContent = how === 'window' ? 'Abrindo o login da Samsung…' : how === 'code' ? 'Verificando…' : '';
  const r = await window.api.oauthStart({
    clientId: $('#oa-id').value.trim(), clientSecret: $('#oa-secret').value.trim(),
    redirectUri: $('#oa-redirect').value.trim(), code: $('#oa-code').value.trim(), how,
  });
  if (r.pending) { msg.textContent = 'Faça o login no navegador. No fim, copie o endereço da página e cole no campo abaixo.'; return; }
  if (!r.ok) { msg.textContent = OAUTH_ERR[r.error] || 'Não consegui conectar. Confira a internet.'; return; }
  await afterAuth();
}

appEl.addEventListener('click', e => {
  if (e.target.classList.contains('sheet-back')) return S.sheet === 'news' ? actions.newsOk() : closeSheet();
  const b = e.target.closest('[data-action]');
  if (!b || b.disabled) return;
  actions[b.dataset.action]?.(b.dataset.arg);
});
appEl.addEventListener('change', async e => {
  const d = selected();
  const t = e.target;
  if (t.id === 'osc') send(d, 'fanOscillationMode', 'setFanOscillationMode', [t.value], { osc: t.value });
  if (t.id === 'special') send(d, 'custom.airConditionerOptionalMode', 'setAcOptionalMode', [t.value], { special: t.value });
  if (t.id === 'timer') {
    const minutes = Number(t.value);
    if (minutes < 0) return;
    const timers = S.demo ? { ...S.data.timers, [d.id]: minutes ? Date.now() + minutes * 60000 : undefined }
      : await window.api.setTimer(d.id, minutes);
    S.data.timers = timers;
    render();
  }
  if (t.id === 'tariff') { const v = parseFloat(String(t.value).replace(',', '.')); if (v > 0) saveSetting({ tariff: v }); }
  if (t.id === 'budget') { const v = parseFloat(String(t.value).replace(',', '.')); saveSetting({ budget: v > 0 ? v : 0 }); }
  if (t.id === 'hotkey-dev') saveSetting({ hotkeyDevice: t.value });
  if (t.id === 'night-temp') saveSetting({ nightTemp: Math.min(30, Math.max(16, Number(t.value) || 23)) });
  if (t.id === 'night-off') saveSetting({ nightOff: t.value || '' });
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && S.sheet) (S.sheet === 'news' ? actions.newsOk : closeSheet)();
  if (e.key === 'Enter' && e.target.id === 'token') actions.tokenSave();
});

// ---------- barra de título ----------
$('#tb-min').onclick = () => window.api.minimize();
$('#tb-max').onclick = () => window.api.maximize();
$('#tb-close').onclick = () => window.api.close();
$('#tb-settings').onclick = () => actions.settings();
function showUpdate(u) {
  S.update = u || { status: 'idle' };
  const b = $('#tb-update');
  const st = S.update.status;
  b.hidden = !['available', 'downloading', 'ready'].includes(st);
  b.disabled = st === 'downloading';
  b.textContent = st === 'available' ? `Atualizar para ${S.update.version}` : st === 'downloading' ? `Baixando ${S.update.percent || 0}%` : 'Reiniciar e atualizar';
  const row = $('#upd-status');
  if (row) row.textContent = updText();
}
function updText() {
  const u = S.update || {};
  return u.status === 'available' ? `Versão ${u.version} disponível.` : u.status === 'downloading' ? 'Baixando…' : u.status === 'ready' ? 'Pronta para instalar.' : 'Você está na versão mais recente.';
}
$('#tb-update').onclick = () => window.api.updateInstall();
window.api.onUpdate?.(showUpdate);
window.api.updateGet?.().then(showUpdate);
$('#tb-mini').onclick = () => actions.miniToggle();
window.api.onMaximized?.(m => {
  $('#tb-max').innerHTML = m ? ICON.maxOn : ICON.maxOff;
  $('#tb-max').setAttribute('aria-label', m ? 'Restaurar' : 'Maximizar');
});

// ---------- desenho ----------
const NEWS_URL = 'https://blog.smartthings.com/smartthings-updates/smartthings-api-additional-details-for-developers-and-business-partners/';
const link = (url, text) => `<span class="link" role="link" tabindex="0" data-action="link" data-arg="${url}">${text}</span>`;
const span = ms => { const m = Math.max(0, Math.round(ms / 60000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`; };
const tokenLeft = () => (S.settings?.authMode === 'pat' && S.settings.tokenExpiresAt ? S.settings.tokenExpiresAt - Date.now() : null);

function render() {
  $('#tb-settings').classList.toggle('active', S.view === 'settings');
  $('#tb-mini').classList.toggle('active', !!S.settings?.mini);
  if (S.view === 'settings') renderSettings();
  else if (!S.settings?.hasToken && !S.demo) renderOnboard();
  else renderHome();
  if (S.sheet) appEl.insertAdjacentHTML('beforeend', renderSheet());
}

function renderHome() {
  const date = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const upd = S.updatedAt ? ` · atualizado às ${hhmm(S.updatedAt)}` : '';
  appEl.innerHTML = `
  <div class="shell">
    <header class="top">
      <div><h1>${esc(S.data?.location || 'Clima')}</h1><div class="date">${esc(date.charAt(0).toUpperCase() + date.slice(1))}${upd}</div></div>
      ${renderTopRight()}
    </header>
    ${S.data ? `<div class="grid">
      <nav class="side" aria-label="Aparelhos">${devices().map(renderCard).join('')}${renderScenes()}${renderWeather()}</nav>
      <main class="panel">${renderPanel()}</main>
    </div>` : `<div class="center"><p class="dev-sub">${S.error ? 'Não consegui carregar os aparelhos.' : 'Carregando…'}</p></div>`}
  </div>`;
}

function renderTopRight() {
  if (S.error === 'token') return `<div class="alert" role="status">${S.settings?.authMode === 'oauth' ? 'O login da Samsung expirou' : 'O token de 24 horas expirou'} <button data-action="connect">${S.settings?.authMode === 'oauth' ? 'Entrar de novo' : 'Colar um novo'}</button></div>`;
  if (S.error === 'forbidden') return `<div class="alert" role="status">A Samsung recusou o acesso à conta <button data-action="account">Ver conta</button></div>`;
  if (S.error === 'rate') return `<div class="alert info" role="status">A Samsung pediu uma pausa nas consultas. Volto a atualizar em instantes.</div>`;
  if (S.error === 'net') return `<div class="alert info" role="status">Sem conexão com o SmartThings <button data-action="retry">Tentar de novo</button></div>`;
  if (S.error === 'cmd') return `<div class="alert info" role="status">O aparelho não aceitou o comando <button data-action="retry">Atualizar</button></div>`;
  if (S.flash) return `<div class="alert info" role="status">${esc(S.flash)}</div>`;
  const left = tokenLeft();
  if (left != null && left < 3 * 3600000) return `<div class="alert info" role="status">${left > 0 ? `O token expira em até ${span(left)}` : 'O token já deve ter expirado'} <button data-action="connect">Renovar</button></div>`;
  const a = alerts()[0];
  if (a) return `<div class="alert${a.c.level === 'cold' ? ' info' : ''}" role="status">${ICON.therm}<span>${esc(a.d.name)} está ${{ hot: 'quente', humid: 'abafado', cold: 'frio' }[a.c.level]} · <b>${esc(a.c.why)}</b></span>
    <button data-action="turnOn" data-arg="${esc(a.d.id)}">${esc(a.c.action.text)}</button></div>`;
  if (S.demo) return `<div class="alert info">Modo demonstração <button data-action="connect">Conectar</button></div>`;
  const acs = devices().filter(d => d.kind === 'ac' && !d.offline);
  if (!acs.length) return '';
  const on = acs.filter(d => d.on);
  const watts = on.reduce((s, d) => s + (d.power || 0), 0);
  return `<div class="summary">${on.length} de ${acs.length} ares ligados${watts ? ` · ${Math.round(watts)} W agora` : ''}</div>`;
}

function renderCard(d) {
  const sel = d.id === S.sel ? ' sel' : '';
  if (d.offline) return `<button class="dev${sel}" data-action="select" data-arg="${esc(d.id)}"><div class="dev-row"><div class="dev-id">
    <div class="dev-icon">${d.kind === 'ac' ? ICON.snow : ICON.washer}</div><div><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">Sem conexão</div></div></div></div></button>`;
  if (d.kind === 'washer') {
    const active = d.state === 'running' || d.state === 'paused';
    const end = d.remaining ? hhmm(new Date(Date.now() + d.remaining * 60000)) : null;
    const waiting = S.data?.washDone?.[d.id] && !active;
    return `<button class="dev washer${sel}" data-action="select" data-arg="${esc(d.id)}" aria-label="${esc(d.name)}">
      <div class="dev-row"><div class="dev-id"><div class="dev-icon washer">${ICON.washer}</div>
        <div><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">${d.state === 'paused' ? 'Pausada' : waiting ? 'Terminou, roupa na máquina' : esc(L.jobs[d.job] || (active ? 'Em andamento' : 'Parada'))}</div></div></div>
        ${d.state === 'running' && end ? `<div class="dev-end"><span class="dev-sub">termina</span><b>${end}</b></div>` : ''}
      </div>${active ? `<div class="bar"><div style="width:${Math.max(3, d.progress || 0)}%"></div></div>` : ''}</button>`;
  }
  const c = comfort(d.temp, d.humidity, d.modes);
  const hot = !d.on && c?.action;
  const amb = [d.temp != null ? deg(d.temp) : null, d.humidity != null ? `${d.humidity}%` : null].filter(Boolean).join(' · ');
  const t = timerEnd(d.id);
  const sub = d.on ? `${esc(L.modeSub[d.mode] || 'Ligado')}${t ? ` · até ${hhmm(new Date(t))}` : amb ? ` · ${amb}` : ''}`
    : `Desligado${amb ? ` · <span class="${hot ? 'hot' : ''}">${amb}</span>` : ''}`;
  return `<button class="dev${sel}" data-action="select" data-arg="${esc(d.id)}" aria-label="${esc(d.name)}">
    <div class="dev-row"><div class="dev-id"><div class="dev-icon${d.on ? ' on' : ''}">${modeIcon(d.mode)}</div>
      <div style="min-width:0"><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">${sub}</div></div></div>
      <div class="dev-temp${d.on ? '' : ' off'}">${d.on ? deg(d.setpoint) : '—'}</div></div></button>`;
}

function renderScenes() {
  const acs = devices().filter(d => d.kind === 'ac' && !d.offline);
  if (!acs.length) return '';
  const scenes = S.settings?.scenes || [];
  return `<section class="scenes" aria-label="Cenas">
    ${scenes.map(x => `<button class="pill small" data-action="scene" data-arg="${esc(x.id)}">${esc(x.name)}</button>`).join('')}
    <button class="pill small" data-action="scene" data-arg="all-off" ${acs.some(d => d.on) ? '' : 'disabled'}>Desligar tudo</button>
    ${scenes.length ? '' : '<button class="pill small ghost" data-action="settings">Criar cena</button>'}
  </section>`;
}

function renderWeather() {
  const w = S.data?.weather;
  if (!w?.current) return '';
  const days = [1, 2, 3, 4].filter(i => w.daily.time[i]).map(i => {
    const dow = DAYS[new Date(w.daily.time[i] + 'T12:00').getDay()];
    return `<div>${dow}<b>${deg(w.daily.temperature_2m_max[i])}</b><small>${deg(w.daily.temperature_2m_min[i])}</small><span class="rain">${ICON.dropSm}${w.daily.precipitation_probability_max[i] ?? 0}%</span></div>`;
  }).join('');
  const t = s => s ? s.slice(11, 16) : '—';
  return `<section class="weather" aria-label="Clima lá fora">
    <div class="w-now"><div><div class="dev-sub">Lá fora</div><div class="w-temp">${deg(w.current.temperature_2m)}</div></div>
      <div class="w-desc">${WMO(w.current.weather_code)}<br>máx ${deg(w.daily.temperature_2m_max[0])} · mín ${deg(w.daily.temperature_2m_min[0])}
      ${w.current.apparent_temperature != null ? `<br>sensação ${deg(w.current.apparent_temperature)} · ${w.current.relative_humidity_2m}%` : ''}</div></div>
    <div class="w-days">${days}</div>
    ${w.daily.sunrise ? `<div class="w-extra"><span>Nascer ${t(w.daily.sunrise[0])}</span><span>Pôr do sol ${t(w.daily.sunset[0])}</span>${w.daily.uv_index_max ? `<span>UV ${Math.round(w.daily.uv_index_max[0])}</span>` : ''}</div>` : ''}
  </section>`;
}

function renderPanel() {
  const d = selected();
  if (!d) return `<div class="center"><p class="dev-sub">Nenhum ar-condicionado ou lavadora encontrado nesta conta.</p></div>`;
  if (d.offline) return `<div class="panel-title">${esc(d.name)}</div><div class="note">Esse aparelho não respondeu. Confira se ele está ligado na tomada e no Wi-Fi.</div>`;
  return d.kind === 'washer' ? renderWasher(d) : renderAc(d);
}

function renderRoomChart(d) {
  const pts = (d.climate?.t || []).map((v, i) => (v == null ? null : [i, v])).filter(Boolean);
  if (pts.length < 2) return '<div class="chart-empty">O histórico do quarto aparece depois de algumas horas com o app aberto.</div>';
  const vals = pts.map(p => p[1]);
  const lo = Math.min(...vals) - 1, hi = Math.max(...vals) + 1;
  const line = pts.map(([i, v]) => `${((i / 23) * 480).toFixed(1)},${(86 - ((v - lo) / (hi - lo)) * 82).toFixed(1)}`).join(' ');
  return `<svg class="line" viewBox="0 0 480 90" preserveAspectRatio="none" role="img" aria-label="Temperatura do quarto hoje, entre ${Math.round(lo + 1)}° e ${Math.round(hi - 1)}°">
    <polyline points="${line}" fill="none" stroke="var(--green)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
}

const bar = (v, max) => (v <= 0 ? '<div class="empty"></div>' : `<div style="height:${Math.max(8, (v / max) * 100)}%"></div>`);
function renderEnergy(d) {
  const hist = d.history || {};
  const tariff = S.settings?.tariff || 0.85;
  const now = new Date();
  const nowH = now.getHours();
  const tab = (k, l) => `<button data-action="range" data-arg="${k}" aria-pressed="${S.range === k}">${l}</button>`;
  const seg = `<div class="seg small" role="group" aria-label="O que mostrar">${tab('day', 'Hoje')}${tab('week', '7 dias')}${tab('month', 'Mês')}${tab('room', 'Quarto')}</div>`;
  const hourAxis = '<div class="axis"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></div>';
  if (S.range === 'room') {
    const vals = (d.climate?.t || []).filter(v => v != null);
    const mm = vals.length ? `Hoje: mín ${deg(Math.min(...vals))} · máx ${deg(Math.max(...vals))}` : 'Sem leituras ainda hoje';
    return `<section class="energy" aria-label="Temperatura do quarto hoje">
      <div class="e-left"><div class="e-label">Quarto agora</div>
        <div class="e-value">${d.temp != null ? fmt1(d.temp) : '—'}<small>°C</small></div>
        <div class="e-cost">${d.humidity != null ? `Umidade ${d.humidity}%` : ''}</div><div class="e-now">${mm}</div></div>
      <div class="chart"><div class="chart-head">${seg}</div>${renderRoomChart(d)}${hourAxis}</div></section>`;
  }
  let total, bars, axis, extra = '', label;
  if (S.range === 'month') {
    const days = hist.monthDays || [];
    const inMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    total = days.reduce((s, x) => s + x.wh, 0);
    const max = Math.max(...days.map(x => x.wh), 1);
    bars = `<div class="bars month" aria-hidden="true">${Array.from({ length: inMonth }, (_, i) => (i < days.length ? bar(days[i].wh, max) : '<div class="future"></div>')).join('')}</div>`;
    axis = `<div class="axis"><span>1</span><span>${Math.round(inMonth / 2)}</span><span>${inMonth}</span></div>`;
    label = now.toLocaleDateString('pt-BR', { month: 'long' }).replace(/^./, c => c.toUpperCase());
    const cost = (total / 1000) * tariff;
    const proj = (cost / now.getDate()) * inMonth;
    const budget = S.settings?.budget || 0;
    if (now.getDate() >= 3 && total > 0) extra = `<div class="e-delta${budget > 0 && proj > budget ? ' up' : ' plain'}">No ritmo atual: ${brl(proj)} no mês${budget > 0 ? `, meta de ${brl(budget)}` : ''}</div>`;
    if (hist.prevSame != null && hist.prevSame > 0) extra += `<div class="e-now">Mês passado, até o dia ${now.getDate()}: ${kwh(hist.prevSame)} kWh</div>`;
    const all = S.data?.monthWh ?? 0;
    if (all > total) extra += `<div class="e-now">Todos os ares: ${kwh(all)} kWh · ${brl((all / 1000) * tariff)}</div>`;
  } else if (S.range === 'week') {
    const week = hist.week || [];
    total = week.reduce((s, x) => s + x.wh, 0);
    const max = Math.max(...week.map(x => x.wh), 1);
    bars = `<div class="bars week" aria-hidden="true">${week.map(x => bar(x.wh, max)).join('')}</div>`;
    axis = `<div class="axis week">${week.map(x => `<span>${DAYS[new Date(x.date + 'T12:00').getDay()]}</span>`).join('')}</div>`;
    label = 'Últimos 7 dias';
    const used = week.filter(x => x.wh > 0);
    if (used.length > 1) extra = `<div class="e-now">Média de ${kwh(total / used.length)} kWh nos dias com uso</div>`;
  } else {
    const h = hist.hours || Array(24).fill(0);
    total = h.reduce((a, b) => a + b, 0);
    const max = Math.max(...h, 1);
    bars = `<div class="bars" aria-hidden="true">${h.map((v, i) => (i > nowH ? '<div class="future"></div>' : bar(v, max))).join('')}</div>`;
    axis = hourAxis;
    label = 'Consumo hoje';
    const y = hist.yHours;
    if (y) {
      const ySoFar = y.slice(0, nowH + 1).reduce((a, b) => a + b, 0);
      if (ySoFar >= 500) {
        const p = Math.round(((total - ySoFar) / ySoFar) * 100);
        if (p) extra = `<div class="e-delta${p > 0 ? ' up' : ''}">${Math.abs(p)}% a ${p > 0 ? 'mais' : 'menos'} que ontem até esta hora</div>`;
      }
    }
    extra += `<div class="e-now">${d.on && d.power ? `Usando ${Math.round(d.power)} W agora · ${brl((d.power / 1000) * tariff)} por hora` : total === 0 ? 'Sem consumo anotado hoje' : 'Desligado agora'}</div>`;
  }
  return `<section class="energy" aria-label="Consumo de energia">
    <div class="e-left"><div class="e-label">${label}</div>
      <div class="e-value">${kwh(total)}<small>kWh</small></div>
      <div class="e-cost">≈ ${brl((total / 1000) * tariff)}</div>${extra}</div>
    <div class="chart"><div class="chart-head">${seg}</div>${bars}${axis}</div></section>`;
}

function renderAc(d) {
  const off = d.on ? '' : ' dim';
  const modes = L.order.modes.filter(m => d.modes.includes(m));
  const fans = L.order.fans.filter(f => d.fans.includes(f));
  const avail = d.fansAvailable?.length ? d.fansAvailable : fans;
  const c = comfort(d.temp, d.humidity, d.modes);
  const sub = [d.temp != null ? `Ambiente ${deg(d.temp)}` : null, d.humidity != null ? `Umidade ${d.humidity}%` : null,
    c ? `Sensação ${fmt1(c.at)}°, <span class="lvl ${c.level}">${c.label.toLowerCase()}</span>` : null,
    d.on && d.onSince ? `Ligado há ${span(Date.now() - d.onSince)}` : null].filter(Boolean).join(' · ');
  const tip = insight(d);
  const opt = (map, list, cur) => list.map(v => `<option value="${esc(v)}"${v === cur ? ' selected' : ''}>${esc(map[v] || v)}</option>`).join('');
  const t = timerEnd(d.id);
  const timerOpts = (t ? `<option value="-1" selected>Desliga às ${hhmm(new Date(t))}</option><option value="0">Cancelar timer</option>`
    : '<option value="0" selected>Não desligar</option>') + TIMERS.map(([m, l]) => `<option value="${m}">Em ${l}</option>`).join('');
  const filter = d.filterCapacity ? `Filtro: ${d.filterUsage ?? 0} de ${d.filterCapacity} h de uso` : '';
  const clean = d.autoClean ? `Autolimpeza ${d.autoClean === 'on' ? 'ligada' : 'desligada'}` : '';
  return `
    <div class="panel-head"><div><div class="panel-title">${esc(d.name)}</div><div class="panel-sub">${sub}</div></div>
      <div class="head-actions"><button class="pill small" data-action="night">Boa noite</button>
      <button class="toggle" role="switch" aria-checked="${d.on}" aria-label="Ligar ou desligar" data-action="power"></button></div></div>
    ${tip ? `<div class="tip">${ICON.bulb}<span>${esc(tip)}</span></div>` : ''}
    ${renderEnergy(d)}
    <div class="temp-row${off}">
      <div><div class="e-label">Temperatura</div><div class="temp-big">${deg(d.setpoint)}</div></div>
      <div style="display:flex;gap:12px">
        <button class="round" data-action="temp" data-arg="-1" aria-label="Diminuir temperatura" ${d.setpoint <= d.min ? 'disabled' : ''}>−</button>
        <button class="round" data-action="temp" data-arg="1" aria-label="Aumentar temperatura" ${d.setpoint >= d.max ? 'disabled' : ''}>+</button>
      </div>
      <div class="temp-note">${d.min}° a ${d.max}°</div>
    </div>
    <div class="${off.trim()}" style="display:flex;flex-direction:column;gap:14px">
      <div class="seg" role="group" aria-label="Modo">${modes.map(m => `<button data-action="mode" data-arg="${m}" aria-pressed="${d.mode === m}">${L.modes[m]}</button>`).join('')}</div>
      <div class="line"><span>Ventilador</span><div class="seg" role="group" aria-label="Ventilador">${fans.map(f =>
        `<button data-action="fan" data-arg="${f}" aria-pressed="${d.fan === f}" ${avail.includes(f) ? '' : 'disabled'}>${L.fans[f]}</button>`).join('')}</div></div>
      <div class="selects">
        ${d.oscs.length ? `<label>Direção do vento<select id="osc">${opt(L.oscs, d.oscs, d.osc)}</select></label>` : ''}
        ${d.specials.length ? `<label>Modo especial<select id="special">${opt(L.specials, d.specials, d.special)}</select></label>` : ''}
        <label>Desligar sozinho<select id="timer">${timerOpts}</select></label>
      </div>
    </div>
    <div class="line auto-line"><span><b>Conforto automático</b> · liga sozinho quando o quarto fica quente ou abafado</span>
      <button class="toggle" role="switch" aria-checked="${!!S.settings?.auto?.[d.id]}" aria-label="Conforto automático" data-action="auto"></button></div>
    <div class="foot"><span>${[filter, clean].filter(Boolean).join(' · ')}</span>${d.on && d.mode === 'auto' && avail.length === 1 ? '<span>No modo Auto o ventilador fica em Auto</span>' : ''}</div>`;
}

function renderWasher(d) {
  const running = d.state === 'running', paused = d.state === 'paused';
  const active = running || paused;
  const end = d.remaining ? hhmm(new Date(Date.now() + d.remaining * 60000)) : null;
  const done = S.data?.washDone?.[d.id];
  const phases = d.phases.map(p => `<div class="phase${p.phaseName === d.job ? ' now' : ''}"><b>${esc(L.phases[p.phaseName] || p.phaseName)}</b>${p.timeInMin} min</div>`).join('');
  return `
    <div class="panel-head"><div><div class="panel-title">${esc(d.name)}</div>
      <div class="panel-sub">${paused ? 'Pausada' : esc(L.jobs[d.job] || (active ? 'Em andamento' : 'Parada'))}${d.kidsLock ? ' · trava infantil ligada' : ''}</div></div></div>
    ${done && !active ? `<div class="tip">${ICON.bulb}<span style="flex:1">A lavagem terminou às ${hhmm(new Date(done))}. A roupa ainda está na máquina?</span><button class="pill small" data-action="washDismiss" data-arg="${esc(d.id)}">Já tirei</button></div>` : ''}
    ${active ? `<div><div class="e-label">${paused ? 'Pausada, faltam' : 'Termina às'}</div>
      <div class="wash-big"><span class="t">${paused ? `${d.remaining} min` : end ?? '—'}</span>${!paused && d.remaining ? `<span class="dev-sub">faltam ${d.remaining} min</span>` : ''}</div></div>
      <div class="bar" style="height:10px"><div style="width:${Math.max(3, d.progress || 0)}%"></div></div>`
      : `<div><div class="e-label">Programa atual</div><div class="wash-big"><span class="t">${d.remaining ?? '—'}</span><span class="dev-sub">minutos no total</span></div></div>`}
    ${phases ? `<div class="phases">${phases}</div>` : ''}
    ${d.remote ? `<div class="btns">
        ${running ? '<button class="pill" data-action="washer" data-arg="pause">Pausar</button>' : ''}
        ${!running ? `<button class="pill primary" data-action="washer" data-arg="run">${paused ? 'Continuar' : 'Iniciar'}</button>` : ''}
        ${active ? '<button class="pill" data-action="washer" data-arg="stop">Parar</button>' : ''}
      </div>`
      : `<div class="note">Para iniciar ou pausar pelo app, ative o controle remoto no painel da lavadora (botão Smart Control). É uma trava de segurança da Samsung.</div>`}
    <div class="foot"><span>${d.spin ? `Centrifugação ${esc(L.spin[d.spin] || d.spin)}` : ''}</span><span>${d.rinses != null ? `${esc(d.rinses)} enxágue${d.rinses === '1' ? '' : 's'}` : ''}</span></div>`;
}

function renderOnboard() {
  appEl.innerHTML = `<div class="shell"><div class="center"><div class="onboard">
    <img src="${document.querySelector('.tb-brand img').src}" alt="">
    <h1>Clima</h1>
    <p>Controle os seus ares-condicionados e a lavadora Samsung pelo SmartThings, com avisos, agendamentos e consumo de energia.</p>
    <div class="btns"><button class="pill dark" data-action="sheet" data-arg="token">Conectar SmartThings</button><button class="pill" data-action="demo">Ver demonstração</button></div>
  </div></div></div>`;
}

// ---------- folhas (conectar, novidades) ----------
const NEWS = [
  ['Cenas', 'Um clique aplica um ajuste em um ar ou em todos. Crie as suas nas Configurações; elas também aparecem no ícone da bandeja.'],
  ['Consumo do mês', 'Nova aba Mês, com cada dia, o ritmo de gasto e a comparação com o mês passado. O gráfico agora continua certo mesmo se o app ficou fechado, e dá para exportar tudo em planilha.'],
  ['Avisos que funcionam na bandeja', 'Lavadora, quarto quente, filtro para lavar e ar ligado há muitas horas avisam mesmo com a janela fechada.'],
  ['Conectar ficou simples', 'Copie o token no site da Samsung e clique em Colar e conectar. O app avisa antes de o token expirar.'],
  ['Menos consultas à Samsung', 'Escondido na bandeja, o app consulta só o necessário, para caber no limite mensal da API.'],
  ['Boa noite do seu jeito', 'Escolha a temperatura e, se quiser, a hora de desligar de manhã.'],
  ['Atualização pelo próprio app', 'Quando sair versão nova, aparece um botão na barra de título.'],
];
function renderSheet() {
  if (S.sheet === 'news') return `<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true" aria-label="Novidades">
    <h2>Clima ${esc((S.settings?.version || '1.0').split(' ')[0])}</h2>
    <div class="news">${NEWS.map(([t, d]) => `<div><b>${t}</b><span>${d}</span></div>`).join('')}</div>
    <div class="sheet-foot"><button class="pill dark" data-action="newsOk">Entendi</button></div></div></div>`;
  const renew = S.settings?.authMode === 'pat';
  return `<div class="sheet-back"><div class="sheet" role="dialog" aria-modal="true" aria-label="Conectar ao SmartThings">
    <button class="icon-x sheet-x" data-action="sheetClose" aria-label="Fechar">${ICON.x}</button>
    <h2>${renew ? 'Renovar o token' : 'Conectar ao SmartThings'}</h2>
    <ol class="steps">
      <li><div><b>Gere um token no site da Samsung</b><span>Entre com a conta dos seus aparelhos, crie um token e marque pelo menos Dispositivos e Locais.</span></div>
        <button class="pill" data-action="tokenPage">Abrir o site</button></li>
      <li><div><b>Copie o token e volte aqui</b><span>Ele só aparece uma vez na página da Samsung.</span></div>
        <button class="pill dark" data-action="tokenPaste">Colar e conectar</button></li>
    </ol>
    <div class="row"><input id="token" type="password" placeholder="Ou cole o token aqui" aria-label="Token" autocomplete="off"><button class="pill" data-action="tokenSave">Conectar</button></div>
    <div class="msg" id="token-msg" role="status"></div>
    <p class="sheet-note">O token vale 24 horas e fica guardado só neste computador, criptografado pelo Windows. A Samsung passou a cobrar pelo acesso permanente à API e anunciou o fim dos tokens gratuitos para 15/12/2026. ${link(NEWS_URL, 'Ler o aviso da Samsung')}</p>
  </div></div>`;
}

// ---------- configurações ----------
function daysText(days) {
  const k = [...days].sort().join();
  if (days.length === 7) return 'Todo dia';
  if (k === '1,2,3,4,5') return 'Seg a Sex';
  if (k === '0,6') return 'Fim de semana';
  return [...days].sort().map(d => DAYS[d]).join(', ');
}
const devName = id => (id === 'all' ? 'Todos os ares' : devices().find(d => d.id === id)?.name || 'Ar');
const actText = x => (x.action === 'off' ? 'Desligar' : `Ligar no ${L.modes[x.mode] || 'Frio'}${x.mode === 'wind' ? '' : ` a ${x.setpoint}°`}`);
const scheduleText = x => `${devName(x.deviceId)} · ${actText(x)}${x.precool && x.action === 'on' ? ' · pré-resfriar' : ''} · ${daysText(x.days)}`;

function renderAccount(s) {
  const left = tokenLeft();
  const status = s.authMode === 'oauth' ? 'Conectado com login Samsung, renova sozinho'
    : s.authMode === 'pat' ? (left == null ? 'Conectado com token de 24 horas' : left > 0 ? `Token ativo · expira em até ${span(left)}` : 'O token já deve ter expirado')
    : 'Não conectado';
  return `<section class="set-card" id="conta"><h2>Conta SmartThings</h2>
    <div class="set-row"><span class="${s.hasToken && (left == null || left > 0) ? 'status-ok' : 'label'}">${s.hasToken && (left == null || left > 0) ? ICON.check : ''} ${status}</span>
      <div class="row-end">${s.authMode !== 'oauth' ? `<button class="pill small dark" data-action="sheet" data-arg="token">${s.authMode === 'pat' ? 'Renovar' : 'Conectar'}</button>` : ''}
      ${s.hasToken ? '<button class="pill small" data-action="clearToken">Sair</button>' : ''}</div></div>
    <div class="set-col"><div class="hint">A Samsung passou a cobrar pelo acesso permanente à API do SmartThings. O token gratuito vale 24 horas, e o fim dele foi anunciado para 15/12/2026. Depois disso, o Clima só funciona com o plano de desenvolvedor da Samsung. ${link(NEWS_URL, 'Ler o aviso')}</div>
      <div class="hint">Consultas à Samsung neste mês: <b>${(s.apiCalls || 0).toLocaleString('pt-BR')}</b>. O plano de desenvolvedor informa limite de 100 mil por mês.</div></div>
    <details class="set-col"><summary class="label">Tenho o plano de desenvolvedor (login permanente)</summary>
      <div class="set-col" style="border:0;padding-bottom:0">
        <div class="hint">Com o plano ativo, crie o app no terminal com <b>npx @smartthings/cli@2 apps:create</b> (tipo OAuth-In App, Redirect URI igual à de baixo) e cole aqui o Client ID e o Client Secret.</div>
        <input id="oa-id" placeholder="Client ID" aria-label="Client ID" value="${esc(s.oauthClientId)}" autocomplete="off">
        <input id="oa-secret" type="password" placeholder="${s.oauthHasSecret ? 'Client Secret (já salvo)' : 'Client Secret'}" aria-label="Client Secret" autocomplete="off">
        <input id="oa-redirect" placeholder="Redirect URI" aria-label="Redirect URI" value="${esc(s.oauthRedirect)}" autocomplete="off">
        <div class="row"><button class="pill dark" data-action="oauthLogin">Entrar com a Samsung</button><button class="pill" data-action="oauthBrowser">Abrir no navegador</button></div>
        <div class="row"><input id="oa-code" placeholder="Usou o navegador? Cole aqui o endereço final" aria-label="Endereço final do login no navegador" style="flex:1" autocomplete="off"><button class="pill" data-action="oauthCode">Concluir</button></div>
        <div class="msg" id="oauth-msg" role="status"></div>
      </div></details>
  </section>`;
}

function renderSettings() {
  const s = S.settings || {};
  const acs = devices().filter(d => d.kind === 'ac');
  const tg = (k, label, hint = '', action = 'toggleSet') => `<div class="set-row"><div><div class="label">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>
    <button class="toggle" role="switch" aria-checked="${!!s[k]}" aria-label="${esc(label)}" data-action="${action}" data-arg="${k}"></button></div>`;
  const sg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-action="set" data-arg="${k}:${v}" aria-pressed="${String(s[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  const scheds = s.schedules || [];
  const scenes = s.scenes || [];
  const acOpts = sel => acs.map(d => `<option value="${esc(d.id)}"${d.id === sel ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  const modeOpts = L.order.modes.map(m => `<option value="${m}">${L.modes[m]}</option>`).join('');
  const del = (action, id, what) => `<button class="icon-x" aria-label="Apagar ${esc(what)}" data-action="${action}" data-arg="${esc(id)}">${ICON.x}</button>`;
  appEl.innerHTML = `<div class="settings-page"><div class="settings-inner">
    <div><button class="back" data-action="home">${ICON.back} Voltar</button><h1>Configurações</h1></div>

    <section class="set-card"><h2>Cenas</h2>
      ${scenes.length ? scenes.map(x => `<div class="set-row"><div><div class="label">${esc(x.name)}</div><div class="hint">${esc(`${devName(x.deviceId)} · ${actText(x)}`)}</div></div>${del('sceneDel', x.id, `a cena ${x.name}`)}</div>`).join('')
        : '<div class="set-row"><div class="hint">Uma cena aplica um ajuste com um clique, na tela inicial ou no ícone da bandeja. Exemplos: Dormir, Cheguei, Só o meu quarto.</div></div>'}
      <div class="set-col"><div class="sched-form">
        <label>Nome<input id="cn-name" maxlength="24" placeholder="Dormir"></label>
        <label>Aparelho<select id="cn-dev"><option value="all">Todos os ares</option>${acOpts()}</select></label>
        <label>Ação<select id="cn-action"><option value="on">Ligar</option><option value="off">Desligar</option></select></label>
        <label>Modo<select id="cn-mode">${modeOpts}</select></label>
        <label>Temperatura<input id="cn-temp" type="number" min="16" max="30" value="23"></label>
      </div><div class="sched-form2"><button class="pill dark" data-action="sceneAdd">Adicionar cena</button></div></div>
    </section>

    <section class="set-card"><h2>Agendamentos</h2>
      ${scheds.length ? scheds.map(x => `<div class="set-row"><div><div class="label">${esc(x.time)}</div><div class="hint">${esc(scheduleText(x))}</div></div>
        <div class="row-end"><button class="toggle" role="switch" aria-checked="${x.enabled}" aria-label="Ativar o agendamento das ${esc(x.time)}" data-action="schedToggle" data-arg="${esc(x.id)}"></button>
        ${del('schedDel', x.id, `o agendamento das ${x.time}`)}</div></div>`).join('')
        : '<div class="set-row"><div class="hint">Nenhum agendamento ainda. Crie o primeiro abaixo.</div></div>'}
      <div class="set-col">
        <div class="sched-form">
          <label>Horário<input id="sc-time" type="time" value="22:00"></label>
          <label>Aparelho<select id="sc-dev"><option value="all">Todos os ares</option>${acOpts()}</select></label>
          <label>Ação<select id="sc-action"><option value="on">Ligar</option><option value="off">Desligar</option></select></label>
          <label>Modo<select id="sc-mode">${modeOpts}</select></label>
          <label>Temperatura<input id="sc-temp" type="number" min="16" max="30" value="23"></label>
        </div>
        <div class="sched-form2">
          <div class="days" role="group" aria-label="Dias da semana">${DAYS.map((d, i) => `<label class="day"><input type="checkbox" class="sc-day" value="${i}" checked><span>${d}</span></label>`).join('')}</div>
          <label class="check"><input type="checkbox" id="sc-pre"> Pré-resfriar: liga um pouco antes para chegar na temperatura no horário</label>
          <button class="pill dark" data-action="schedAdd">Adicionar</button>
        </div>
        <div class="hint">Agendamentos, timers e conforto automático funcionam com o PC ligado e o Clima aberto, mesmo na bandeja.</div>
      </div>
    </section>

    <div class="set-grid">
      <div class="set-stack">
        <section class="set-card"><h2>Aparência</h2>
          <div class="set-row"><div class="label">Tema</div>${sg('theme', [['system', 'Sistema'], ['light', 'Claro'], ['dark', 'Escuro']])}</div>
        </section>
        <section class="set-card"><h2>Inicialização e bandeja</h2>
          ${tg('autostart', 'Iniciar com o Windows')}
          ${tg('startHidden', 'Começar escondido na bandeja', 'Abre direto perto do relógio, sem mostrar a janela.')}
          ${tg('closeToTray', 'Fechar mantém na bandeja', 'Para sair de vez, use Sair no ícone da bandeja.')}
        </section>
        <section class="set-card"><h2>Atalhos e mini janela</h2>
          ${tg('hotkeys', 'Atalhos globais', 'Ctrl+Alt+↑ e ↓ mudam a temperatura. Ctrl+Alt+P liga ou desliga. Funcionam em qualquer programa.')}
          <div class="set-row"><label class="label" for="hotkey-dev">Ar dos atalhos</label><select id="hotkey-dev">${acOpts(s.hotkeyDevice) || '<option>Conecte primeiro</option>'}</select></div>
          ${tg('mini', 'Mini janela', 'Um controle pequeno, sempre por cima das outras janelas.', 'miniToggle')}
        </section>
        <section class="set-card"><h2>Avisos</h2>
          ${tg('notifyComfort', 'Sugestões de conforto', 'Quando um quarto com o ar desligado fica quente, abafado ou frio.')}
          ${tg('notifyWasher', 'Lavadora', 'Quando termina, e de novo depois de 15 e 30 minutos.')}
          ${tg('notifyTimer', 'Timer desligou o ar')}
          ${tg('notifyFilter', 'Filtro para lavar', 'Quando o filtro chega ao limite de horas de uso.')}
          <div class="set-row"><div><div class="label">Ar ligado há muito tempo</div><div class="hint">Avisa quando um ar passa tantas horas ligado sem parar.</div></div>${sg('forgotHours', [[0, 'Não'], [6, '6 h'], [10, '10 h'], [14, '14 h']])}</div>
        </section>
      </div>
      <div class="set-stack">
        ${renderAccount(s)}
        <section class="set-card"><h2>Boa noite</h2>
          <div class="set-row"><div><label class="label" for="night-temp">Temperatura</label><div class="hint">O botão Boa noite liga no Frio nessa temperatura, com o modo de sono do aparelho.</div></div>
            <input id="night-temp" type="number" min="16" max="30" value="${s.nightTemp ?? 23}"></div>
          <div class="set-row"><div><label class="label" for="night-off">Desligar de manhã</label><div class="hint">Deixe vazio para não desligar sozinho.</div></div>
            <input id="night-off" type="time" value="${esc(s.nightOff || '')}"></div>
        </section>
        <section class="set-card"><h2>Energia</h2>
          <div class="set-row"><div><label class="label" for="tariff">Tarifa de energia</label><div class="hint">R$ por kWh, com impostos. Está na conta de luz.</div></div>
            <input id="tariff" type="number" min="0.1" max="5" step="0.01" value="${s.tariff ?? 0.85}"></div>
          <div class="set-row"><div><label class="label" for="budget">Meta de gasto mensal</label><div class="hint">R$ por mês com os ares. O app avisa se o ritmo for passar. Use 0 para desligar.</div></div>
            <input id="budget" type="number" min="0" step="10" value="${s.budget ?? 0}"></div>
          <div class="set-row"><div><div class="label">Atualizar a cada</div><div class="hint">Com a janela aberta. Na bandeja o app consulta menos.</div></div>${sg('pollSec', [[30, '30 s'], [60, '1 min'], [120, '2 min']])}</div>
          <div class="set-row"><div><div class="label">Exportar consumo</div><div class="hint" id="csv-msg">Planilha com o consumo por hora de cada ar.</div></div><button class="pill small" data-action="exportCsv">Exportar</button></div>
        </section>
        <section class="set-card"><h2>Sobre</h2>
          <div class="set-row"><div><div class="label">Versão ${esc(s.version || '')}</div><div class="hint" id="upd-status">${esc(updText())}</div></div><button class="pill small" data-action="checkUpdate">Procurar atualização</button></div>
          <div class="set-row"><div class="label">Novidades desta versão</div><button class="pill small" data-action="sheet" data-arg="news">Ver</button></div>
          <div class="set-row"><div><div class="label">Diagnóstico</div><div class="hint" id="diag-msg">Copia um resumo técnico para pedir ajuda. Não inclui token nem senha.</div></div><button class="pill small" data-action="copyDiag">Copiar</button></div>
          <div class="about">A sensação térmica cruza temperatura e umidade (temperatura aparente de Steadman). As sugestões seguem a zona de conforto da norma ASHRAE 55, um pouco mais frescas à noite. Previsão do tempo pelo Open-Meteo. ${link('https://github.com/thiagoawks/clima', 'Código no GitHub')}</div>
        </section>
      </div>
    </div>
  </div></div>`;
}

// ---------- demonstração ----------
function demoData() {
  const nowH = new Date().getHours();
  const hours = Array(24).fill(0).map((_, i) => i > nowH ? 0 : (i < 7 || i > 21 ? 280 + (i % 3) * 60 : i > 12 && i < 18 ? 150 : 0));
  const week = Array(7).fill(0).map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return { date: d.toLocaleDateString('sv-SE'), wh: [3100, 2600, 4200, 3800, 1900, 2400, 0][i] || hours.reduce((a, b) => a + b, 0) }; });
  const base = { modes: ['auto', 'cool', 'dry', 'wind', 'heat'], fans: ['auto', 'low', 'medium', 'high', 'turbo'], fansAvailable: null,
    oscs: ['fixed', 'vertical', 'horizontal', 'all'], specials: ['off', 'sleep', 'quiet', 'smart', 'speed', 'windFree', 'windFreeSleep'],
    min: 16, max: 30, step: 1, filterCapacity: 500, filterStatus: 'normal', autoClean: 'on', kind: 'ac' };
  const t = new Date();
  const monthDays = Array.from({ length: t.getDate() }, (_, i) => ({ date: '', wh: i === t.getDate() - 1 ? hours.reduce((a, b) => a + b, 0) : 1800 + ((i * 37) % 9) * 320 }));
  const month = monthDays.reduce((a, x) => a + x.wh, 0);
  return {
    location: 'Casa', timers: {}, monthWh: Math.round(month * 1.45), washDone: {},
    devices: [
      { ...base, id: 'demo-1', name: 'Quarto Thi', on: true, mode: 'cool', setpoint: 22, temp: 24, humidity: 56, fan: 'medium', osc: 'all', special: 'off', power: 372, filterUsage: 5, climate: { t: Array(24).fill(0).map((_, i) => (i > nowH ? null : 23.5 + 2.2 * Math.sin((i - 9) / 3.8))), h: [] },
        onSince: Date.now() - 200 * 60000,
        history: { hours, yHours: hours.map(v => v * 1.15), week, monthDays, month, prevSame: month * 1.12 } },
      { ...base, id: 'demo-2', name: 'Quarto Mãe', on: false, mode: 'cool', setpoint: 23, temp: 25, humidity: 70, fan: 'auto', osc: 'fixed', special: 'off', power: 0, filterUsage: 120,
        history: { hours: hours.map(v => v * 0.4), yHours: null, week: week.map(x => ({ ...x, wh: x.wh * 0.5 })), monthDays: monthDays.map(x => ({ ...x, wh: x.wh * 0.45 })), month: month * 0.45, prevSame: null } },
      { id: 'demo-3', kind: 'washer', name: 'Lavadora', state: 'running', job: 'rinse', progress: 62, remaining: 23, remote: false, kidsLock: false, spin: 'medium', rinses: '1',
        phases: [{ phaseName: 'wash', timeInMin: 23 }, { phaseName: 'rinse', timeInMin: 20 }, { phaseName: 'spin', timeInMin: 18 }] },
    ],
    weather: { current: { temperature_2m: 20, apparent_temperature: 19, relative_humidity_2m: 82, weather_code: 61, precipitation: 0.2 },
      daily: { time: [0, 1, 2, 3, 4].map(i => { const d = new Date(t); d.setDate(d.getDate() + i); return d.toLocaleDateString('sv-SE'); }),
        temperature_2m_max: [26, 30, 17, 17, 21], temperature_2m_min: [19, 17, 13, 14, 15], precipitation_probability_max: [25, 85, 40, 10, 15],
        sunrise: ['2026-11-06T05:16'], sunset: ['2026-11-06T18:27'], uv_index_max: [7] } },
  };
}

start();
