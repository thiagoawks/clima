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
  range: 'day', notified: new Set(), prevWasher: {}, washDone: {},
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
  render();
  if (S.settings.hasToken) {
    await refresh();
    schedulePoll();
  }
}
function schedulePoll() {
  clearInterval(pollTimer);
  pollTimer = setInterval(refresh, (S.settings?.pollSec || 20) * 1000);
}
async function refresh() {
  if (S.demo || !S.settings?.hasToken) return render();
  try {
    S.data = await window.api.load();
    S.error = null;
    S.updatedAt = new Date();
  } catch (e) {
    S.error = String(e.message || e).includes('TOKEN_INVALID') ? 'token' : 'net';
  }
  S.data?.devices.forEach(d => { if (d.kind === 'ac') d.name = shortName(d.name); });
  if (S.data && !S.data.devices.find(d => d.id === S.sel)) S.sel = S.data.devices[0]?.id ?? null;
  checkNotifications();
  render();
}
window.api.onRefresh?.(() => refresh());
window.api.onSettings?.(async () => { S.settings = await window.api.getSettings(); if (S.view !== 'settings') render(); else $('#tb-mini')?.classList.toggle('active', !!S.settings.mini); });

const devices = () => S.data?.devices || [];
const selected = () => devices().find(d => d.id === S.sel);
const timerEnd = id => S.data?.timers?.[id] || null;

function alerts() {
  return devices().filter(d => d.kind === 'ac' && !d.offline && !d.on)
    .map(d => ({ d, c: comfort(d.temp, d.humidity, d.modes) })).filter(x => x.c?.action);
}

function checkNotifications() {
  if (S.settings?.notifyComfort) {
    for (const { d, c } of alerts()) {
      if (S.notified.has(d.id)) continue;
      S.notified.add(d.id);
      new Notification(`${d.name}: ${c.label.toLowerCase()} (${c.why})`, { body: `Recomendado: ${c.action.text.toLowerCase()}.` });
    }
  }
  for (const id of [...S.notified]) if (!alerts().find(a => a.d.id === id)) S.notified.delete(id);
  for (const w of devices().filter(d => d.kind === 'washer' && !d.offline)) {
    const running = w.state === 'running';
    if (S.prevWasher[w.id] === true && !running && w.state !== 'paused') {
      S.washDone[w.id] = { at: Date.now(), n: 0 };
      if (S.settings?.notifyWasher) new Notification(`${w.name}: a lavagem terminou`, { body: 'Hora de estender a roupa.' });
    }
    if (running) delete S.washDone[w.id];
    // lembra de novo depois de 15 e 30 minutos, até alguém avisar que tirou a roupa
    const wd = S.washDone[w.id];
    if (wd && wd.n < 2 && Date.now() - wd.at >= (wd.n + 1) * 15 * 60000) {
      wd.n++;
      if (S.settings?.notifyWasher) new Notification(`${w.name}: a roupa ainda está lá`, { body: `A lavagem terminou há ${wd.n * 15} minutos.` });
    }
    S.prevWasher[w.id] = running;
  }
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
    S.error = String(e.message || e).includes('TOKEN_INVALID') ? 'token' : 'cmd';
    render();
  }
  setTimeout(refresh, 2500);
}

async function saveSetting(patch) {
  Object.assign(S.settings, patch);
  if ('theme' in patch) applyTheme();
  if ('pollSec' in patch) schedulePoll();
  render();
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
  night: () => {
    const d = selected();
    const sp = d.specials?.includes('windFreeSleep') ? 'windFreeSleep' : d.specials?.includes('sleep') ? 'sleep' : null;
    const list = [['switch', 'on', []], ['airConditionerMode', 'setAirConditionerMode', ['cool']], ['thermostatCoolingSetpoint', 'setCoolingSetpoint', [23]]];
    if (sp) list.push(['custom.airConditionerOptionalMode', 'setAcOptionalMode', [sp]]);
    sendMany(d, list, { on: true, mode: 'cool', setpoint: 23, ...(sp ? { special: sp } : {}) });
  },
  auto: async () => {
    const d = selected();
    const on = !S.settings.auto?.[d.id];
    S.settings.auto = { ...(S.settings.auto || {}), [d.id]: on };
    render();
    if (!S.demo) S.settings.auto = await window.api.setAuto(d.id, on);
  },
  washDismiss: id => { delete S.washDone[id]; render(); },
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
    else showUpdate(r);
  },
  oauthLogin: () => oauth('window'),
  oauthAuto: async () => {
    const msg = $('#auto-msg');
    const token = $('#auto-pat').value.trim();
    if (!token) { msg.textContent = 'Cole o token temporário no campo acima.'; return; }
    msg.textContent = 'Criando o app na Samsung…';
    const r = await window.api.oauthAutoSetup({ token, redirectUri: $('#oa-redirect')?.value.trim() });
    if (!r.ok) {
      msg.textContent = (OAUTH_ERR[r.error] || 'Não consegui conectar.') + (r.detail ? ' (' + r.detail + ')' : '');
      return;
    }
    await afterAuth();
  },
  oauthBrowser: () => oauth('browser'),
  oauthCode: () => oauth('code'),
  settings: () => { S.view = S.view === 'settings' ? 'home' : 'settings'; render(); },
  home: () => { S.view = 'home'; render(); },
  demo: () => { S.demo = true; S.data = demoData(); S.sel = S.data.devices[0].id; S.updatedAt = new Date(); render(); },
  connect: () => { S.view = 'settings'; render(); setTimeout(() => $('#token')?.focus(), 50); },
  retry: refresh,
  set: arg => { const [k, v] = arg.split(':'); saveSetting({ [k]: v === 'true' ? true : v === 'false' ? false : isNaN(v) ? v : Number(v) }); },
  toggleSet: k => saveSetting({ [k]: !S.settings[k] }),
  link: url => window.api.openExternal(url),
  saveToken: async () => {
    const msg = $('#token-msg');
    const token = $('#token').value.trim();
    if (!token) { msg.textContent = 'Cole o token no campo acima.'; return; }
    msg.textContent = 'Verificando…';
    const r = await window.api.setToken(token);
    if (!r.ok) { msg.textContent = r.error === 'TOKEN_INVALID' ? 'Esse token não funcionou. Confira as permissões.' : 'Não consegui conectar. Confira a internet.'; return; }
    await afterAuth();
  },
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
  S.demo = false; S.error = null; S.view = 'home';
  await refresh(); schedulePoll();
}
async function saveSchedules(list) {
  S.settings.schedules = await window.api.setSchedules(list);
  render();
}
const OAUTH_ERR = {
  NO_PAT: 'Cole o token temporário no campo acima.',
  PAT_DENIED: 'A Samsung recusou o token. Gere outro marcando todas as permissões, inclusive as de Apps.',
  CREATE_FAILED: 'A Samsung não deixou criar o app.',
  NETWORK: 'Não consegui falar com a Samsung. Confira a internet.',
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
function render() {
  $('#tb-settings').classList.toggle('active', S.view === 'settings');
  $('#tb-mini').classList.toggle('active', !!S.settings?.mini);
  if (S.view === 'settings') return renderSettings();
  if (!S.settings?.hasToken && !S.demo) return renderOnboard();
  const now = new Date();
  const h = now.getHours();
  const hello = h < 5 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
  const date = now.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
  const upd = S.updatedAt ? ` · atualizado às ${hhmm(S.updatedAt)}` : '';
  appEl.innerHTML = `
  <div class="shell">
    <header class="top">
      <div><div class="date">${esc(date.charAt(0).toUpperCase() + date.slice(1))}${upd}</div><h1>${hello}</h1></div>
      ${renderTopRight()}
    </header>
    ${S.data ? `<div class="grid">
      <nav class="side" aria-label="Aparelhos">${devices().map(renderCard).join('')}${renderWeather()}</nav>
      <main class="panel">${renderPanel()}</main>
    </div>` : `<div class="center"><p class="dev-sub">${S.error ? 'Não consegui carregar os aparelhos.' : 'Carregando…'}</p></div>`}
  </div>`;
}

function renderTopRight() {
  if (S.error === 'token') return `<div class="alert" role="status">A conexão com o SmartThings expirou <button data-action="connect">Reconectar</button></div>`;
  if (S.error === 'net') return `<div class="alert info" role="status">Sem conexão com o SmartThings <button data-action="retry">Tentar de novo</button></div>`;
  if (S.error === 'cmd') return `<div class="alert info" role="status">O aparelho não aceitou o comando <button data-action="retry">Atualizar</button></div>`;
  const a = alerts()[0];
  if (a) return `<div class="alert${a.c.level === 'cold' ? ' info' : ''}" role="status">${ICON.therm}<span>${esc(a.d.name)} está ${{ hot: 'quente', humid: 'abafado', cold: 'frio' }[a.c.level]} · <b>${esc(a.c.why)}</b></span>
    <button data-action="turnOn" data-arg="${esc(a.d.id)}">${esc(a.c.action.text)}</button></div>`;
  if (S.demo) return `<div class="alert info">Modo demonstração <button data-action="connect">Conectar</button></div>`;
  const acs = devices().filter(d => d.kind === 'ac' && !d.offline);
  if (!acs.length) return '';
  const on = acs.filter(d => d.on);
  const watts = on.reduce((s, d) => s + (d.power || 0), 0);
  return `<div class="summary"><span class="dot"></span>${on.length} de ${acs.length} ares ligados${watts ? ` · ${Math.round(watts)} W agora` : ''}</div>`;
}

function renderCard(d) {
  const sel = d.id === S.sel ? ' sel' : '';
  if (d.offline) return `<button class="dev${sel}" data-action="select" data-arg="${esc(d.id)}"><div class="dev-row"><div class="dev-id">
    <div class="dev-icon">${d.kind === 'ac' ? ICON.snow : ICON.washer}</div><div><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">Sem conexão</div></div></div></div></button>`;
  if (d.kind === 'washer') {
    const active = d.state === 'running' || d.state === 'paused';
    const end = d.remaining ? hhmm(new Date(Date.now() + d.remaining * 60000)) : null;
    return `<button class="dev washer${sel}" data-action="select" data-arg="${esc(d.id)}" aria-label="${esc(d.name)}">
      <div class="dev-row"><div class="dev-id"><div class="dev-icon washer">${ICON.washer}</div>
        <div><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">${d.state === 'paused' ? 'Pausada' : esc(L.jobs[d.job] || (active ? 'Em andamento' : 'Parada'))}</div></div></div>
        ${d.state === 'running' && end ? `<div class="dev-end"><span class="dev-sub">termina</span><b>${end}</b></div>` : ''}
      </div>${active ? `<div class="bar"><div style="width:${Math.max(3, d.progress || 0)}%"></div></div>` : ''}</button>`;
  }
  const c = comfort(d.temp, d.humidity, d.modes);
  const hot = !d.on && c?.action;
  const amb = [d.temp != null ? deg(d.temp) : null, d.humidity != null ? `${d.humidity}%` : null].filter(Boolean).join(' · ');
  const t = timerEnd(d.id);
  const sub = d.on ? `${esc(L.modeSub[d.mode] || 'Ligado')}${t ? ` · até ${hhmm(new Date(t))}` : ''}`
    : `Desligado${amb ? ` · <span class="${hot ? 'hot' : ''}">${amb}</span>` : ''}`;
  return `<button class="dev${sel}" data-action="select" data-arg="${esc(d.id)}" aria-label="${esc(d.name)}">
    <div class="dev-row"><div class="dev-id"><div class="dev-icon${d.on ? ' on' : ''}">${modeIcon(d.mode)}</div>
      <div style="min-width:0"><div class="dev-name">${esc(d.name)}</div><div class="dev-sub">${sub}</div></div></div>
      <div class="dev-temp${d.on ? '' : ' off'}">${d.on ? deg(d.setpoint) : '—'}</div></div></button>`;
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
    <div class="w-now"><div><div class="dev-sub">${esc(S.data.location || 'Lá fora')}</div><div class="w-temp">${deg(w.current.temperature_2m)}</div></div>
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

function renderEnergy(d) {
  const hist = d.history || {};
  const tariff = S.settings?.tariff || 0.85;
  const nowH = new Date().getHours();
  const tab = (k, l) => `<button data-action="range" data-arg="${k}" aria-pressed="${S.range === k}">${l}</button>`;
  const seg = `<div class="seg small" role="group" aria-label="O que mostrar">${tab('day', 'Hoje')}${tab('week', '7 dias')}${tab('room', 'Quarto')}</div>`;
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
  if (S.range === 'week') {
    const week = hist.week || [];
    total = week.reduce((s, x) => s + x.wh, 0);
    const max = Math.max(...week.map(x => x.wh), 1);
    bars = `<div class="bars week" aria-hidden="true">${week.map(x => x.wh <= 0 ? '<div class="empty"></div>' : `<div style="height:${Math.max(8, (x.wh / max) * 100)}%"></div>`).join('')}</div>`;
    axis = `<div class="axis week">${week.map(x => `<span>${DAYS[new Date(x.date + 'T12:00').getDay()]}</span>`).join('')}</div>`;
    label = 'Últimos 7 dias';
    const all = S.data?.monthWh ?? hist.month ?? 0;
    const cost = (all / 1000) * tariff;
    const budget = S.settings?.budget || 0;
    if (budget > 0) {
      const now = new Date();
      const proj = (cost / now.getDate()) * new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      extra = `<div class="e-delta${proj > budget ? ' up' : ''}">Projeção do mês: ${brl(proj)} de ${brl(budget)}</div>`;
    }
    if (all) extra += `<div class="e-now">No mês, todos os ares: ${kwh(all)} kWh · ${brl(cost)}</div>`;
  } else {
    const h = hist.hours || Array(24).fill(0);
    total = h.reduce((a, b) => a + b, 0);
    const max = Math.max(...h, 1);
    bars = `<div class="bars" aria-hidden="true">${h.map((v, i) => i > nowH ? '<div class="future"></div>'
      : v <= 0 ? '<div class="empty"></div>' : `<div style="height:${Math.max(8, (v / max) * 100)}%"></div>`).join('')}</div>`;
    axis = hourAxis;
    label = 'Consumo hoje';
    const y = hist.yHours;
    if (y) {
      const ySoFar = y.slice(0, nowH + 1).reduce((a, b) => a + b, 0);
      if (ySoFar >= 500) {
        const p = Math.round(((total - ySoFar) / ySoFar) * 100);
        extra = `<div class="e-delta${p > 0 ? ' up' : ''}">${p > 0 ? '↑' : '↓'} ${Math.abs(p)}% vs. ontem</div>`;
      }
    }
    extra += `<div class="e-now">${d.on && d.power != null ? `Usando ${Math.round(d.power)} W agora` : total === 0 ? 'O gráfico enche com o app aberto' : 'Desligado agora'}</div>`;
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
    c ? `Sensação ${fmt1(c.at)}° <span class="lvl ${c.level}">${c.label}</span>` : null].filter(Boolean).join(' · ');
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
  const phases = d.phases.map(p => `<div class="phase${p.phaseName === d.job ? ' now' : ''}"><b>${esc(L.phases[p.phaseName] || p.phaseName)}</b>${p.timeInMin} min</div>`).join('');
  return `
    <div class="panel-head"><div><div class="panel-title">${esc(d.name)}</div>
      <div class="panel-sub">${paused ? 'Pausada' : esc(L.jobs[d.job] || (active ? 'Em andamento' : 'Parada'))}${d.kidsLock ? ' · trava infantil ligada' : ''}</div></div></div>
    ${S.washDone[d.id] && !active ? `<div class="tip">${ICON.bulb}<span style="flex:1">A lavagem terminou às ${hhmm(new Date(S.washDone[d.id].at))}. A roupa ainda está na máquina?</span><button class="pill small" data-action="washDismiss" data-arg="${esc(d.id)}">Já tirei</button></div>` : ''}
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
    <p>Controle os seus ares-condicionados e a lavadora Samsung pelo SmartThings. Para começar, conecte a sua conta com um token.</p>
    <div class="btns"><button class="pill dark" data-action="connect">Conectar SmartThings</button><button class="pill" data-action="demo">Ver demonstração</button></div>
  </div></div></div>`;
}

// ---------- configurações ----------
function daysText(days) {
  const k = [...days].sort().join();
  if (days.length === 7) return 'Todo dia';
  if (k === '1,2,3,4,5') return 'Seg a Sex';
  if (k === '0,6') return 'Fim de semana';
  return [...days].sort().map(d => DAYS[d]).join(', ');
}
function scheduleText(x) {
  const dev = x.deviceId === 'all' ? 'Todos os ares' : (devices().find(d => d.id === x.deviceId)?.name || 'Ar');
  const act = x.action === 'off' ? 'Desligar' : `Ligar no ${L.modes[x.mode] || 'Frio'}${x.mode === 'wind' ? '' : ` a ${x.setpoint}°`}`;
  return `${dev} · ${act}${x.precool && x.action === 'on' ? ' · pré-resfriar' : ''} · ${daysText(x.days)}`;
}

function renderSettings() {
  const s = S.settings || {};
  const acs = devices().filter(d => d.kind === 'ac');
  const tg = (k, label, hint = '', action = 'toggleSet') => `<div class="set-row"><div><div class="label">${label}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div>
    <button class="toggle" role="switch" aria-checked="${!!s[k]}" aria-label="${esc(label)}" data-action="${action}" data-arg="${k}"></button></div>`;
  const sg = (k, opts) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button data-action="set" data-arg="${k}:${v}" aria-pressed="${String(s[k]) === String(v)}">${l}</button>`).join('')}</div>`;
  const scheds = s.schedules || [];
  const acOpts = sel => acs.map(d => `<option value="${esc(d.id)}"${d.id === sel ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  appEl.innerHTML = `<div class="settings-page"><div class="settings-inner">
    <div><button class="back" data-action="home">${ICON.back} Voltar</button><h1>Configurações</h1></div>

    <section class="set-card"><h2>Agendamentos</h2>
      ${scheds.length ? scheds.map(x => `<div class="set-row"><div><div class="label">${esc(x.time)}</div><div class="hint">${esc(scheduleText(x))}</div></div>
        <div class="row-end"><button class="toggle" role="switch" aria-checked="${x.enabled}" aria-label="Ativar o agendamento das ${esc(x.time)}" data-action="schedToggle" data-arg="${esc(x.id)}"></button>
        <button class="icon-x" aria-label="Apagar o agendamento das ${esc(x.time)}" data-action="schedDel" data-arg="${esc(x.id)}">${ICON.x}</button></div></div>`).join('')
        : '<div class="set-row"><div class="hint">Nenhum agendamento ainda. Crie o primeiro abaixo.</div></div>'}
      <div class="set-col">
        <div class="sched-form">
          <label>Horário<input id="sc-time" type="time" value="22:00"></label>
          <label>Aparelho<select id="sc-dev"><option value="all">Todos os ares</option>${acOpts()}</select></label>
          <label>Ação<select id="sc-action"><option value="on">Ligar</option><option value="off">Desligar</option></select></label>
          <label>Modo<select id="sc-mode">${L.order.modes.map(m => `<option value="${m}">${L.modes[m]}</option>`).join('')}</select></label>
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
      <div style="display:flex;flex-direction:column;gap:16px">
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
        <section class="set-card"><h2>Notificações</h2>
          ${tg('notifyComfort', 'Sugestões de conforto', 'Quando um quarto com o ar desligado fica quente, abafado ou frio.')}
          ${tg('notifyWasher', 'Lavadora', 'Quando termina, e de novo depois de 15 e 30 minutos.')}
          ${tg('notifyTimer', 'Timer desligou o ar')}
        </section>
      </div>
      <div style="display:flex;flex-direction:column;gap:16px">
        <section class="set-card"><h2>Conta SmartThings</h2>
          ${s.hasToken ? `<div class="set-row"><span class="status-ok">${ICON.check} ${s.authMode === 'oauth' ? 'Conectado com login Samsung, renova sozinho' : 'Conectado com token temporário, expira em 24 h'}</span><button class="pill" data-action="clearToken">Sair</button></div>` : ''}
          <div class="set-col">
            <div class="label">Login permanente (jeito fácil)</div>
            <div class="hint">1. Gere um token em <span class="link" role="link" tabindex="0" data-action="link" data-arg="https://account.smartthings.com/tokens">account.smartthings.com/tokens</span> marcando <b>todas</b> as permissões (inclusive Apps). 2. Cole abaixo. O app cria o login permanente sozinho e esquece o token.</div>
            <div class="row"><input id="auto-pat" type="password" placeholder="Token temporário" aria-label="Token temporário para configurar" autocomplete="off" style="flex:1"><button class="pill dark" data-action="oauthAuto">Configurar</button></div>
            <div class="msg" id="auto-msg" role="status"></div>
          </div>
          <details class="set-col"><summary class="label">Já tenho Client ID e Secret</summary>
          <div class="set-col" style="margin-top:10px">
            <input id="oa-id" placeholder="Client ID" aria-label="Client ID" value="${esc(s.oauthClientId)}" autocomplete="off">
            <input id="oa-secret" type="password" placeholder="${s.oauthHasSecret ? 'Client Secret (já salvo)' : 'Client Secret'}" aria-label="Client Secret" autocomplete="off">
            <input id="oa-redirect" placeholder="Redirect URI" aria-label="Redirect URI" value="${esc(s.oauthRedirect)}" autocomplete="off">
            <div class="row"><button class="pill dark" data-action="oauthLogin">Entrar com a Samsung</button><button class="pill" data-action="oauthBrowser">Abrir no navegador</button></div>
            <div class="hint">Preencha só se criou o app pelo CLI. Depois disso o login não expira mais.</div>
            <div class="row"><input id="oa-code" placeholder="Usou o navegador? Cole aqui o endereço final" aria-label="Endereço final do login no navegador" style="flex:1" autocomplete="off"><button class="pill" data-action="oauthCode">Concluir</button></div>
            <div class="msg" id="oauth-msg" role="status"></div>
          </div></details>
          <details class="set-col"><summary class="label">Usar um token temporário (24 h)</summary>
            <div class="row" style="margin-top:10px"><input id="token" type="password" placeholder="Cole o token aqui" aria-label="Token temporário" autocomplete="off" style="flex:1"><button class="pill" data-action="saveToken">Salvar</button></div>
            <div class="hint">Gere em <span class="link" role="link" tabindex="0" data-action="link" data-arg="https://account.smartthings.com/tokens">account.smartthings.com/tokens</span>. Serve para testar, mas precisa trocar todo dia.</div>
            <div class="msg" id="token-msg" role="status"></div>
          </details>
        </section>
        <section class="set-card"><h2>Energia e atualização</h2>
          <div class="set-row"><div><div class="label">Tarifa de energia</div><div class="hint">R$ por kWh, com impostos. Está na conta de luz.</div></div>
            <input id="tariff" type="number" min="0.1" max="5" step="0.01" value="${s.tariff ?? 0.85}" aria-label="Tarifa em reais por kWh"></div>
          <div class="set-row"><div><div class="label">Meta de gasto mensal</div><div class="hint">R$ por mês com os ares. O app projeta o mês e avisa se for passar. Use 0 para desligar.</div></div>
            <input id="budget" type="number" min="0" step="10" value="${s.budget ?? 0}" aria-label="Meta de gasto mensal em reais"></div>
          <div class="set-row"><div class="label">Atualizar a cada</div>${sg('pollSec', [[20, '20 s'], [30, '30 s'], [60, '1 min']])}</div>
        </section>
        <section class="set-card"><h2>Sobre</h2>
          <div class="set-row"><div><div class="label">Versão ${esc(s.version || '')}</div><div class="hint" id="upd-status">${esc(updText())}</div></div><button class="pill" data-action="checkUpdate">Procurar atualização</button></div>
          <div class="about">
          A sensação térmica cruza temperatura e umidade (temperatura aparente de Steadman). As sugestões seguem a zona de conforto da norma ASHRAE 55, um pouco mais frescas à noite. Previsão do tempo pelo Open-Meteo.</div>
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
  return {
    location: 'Casa', timers: {}, monthWh: 69200,
    devices: [
      { ...base, id: 'demo-1', name: 'Quarto Thi', on: true, mode: 'cool', setpoint: 22, temp: 24, humidity: 56, fan: 'medium', osc: 'all', special: 'off', power: 372, filterUsage: 5, climate: { t: Array(24).fill(0).map((_, i) => (i > nowH ? null : 23.5 + 2.2 * Math.sin((i - 9) / 3.8))), h: [] },
        history: { hours, yHours: hours.map(v => v * 1.15), week, month: 48200 } },
      { ...base, id: 'demo-2', name: 'Quarto Mãe', on: false, mode: 'cool', setpoint: 23, temp: 25, humidity: 70, fan: 'auto', osc: 'fixed', special: 'off', power: 0, filterUsage: 120,
        history: { hours: hours.map(v => v * 0.4), yHours: null, week: week.map(x => ({ ...x, wh: x.wh * 0.5 })), month: 21000 } },
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
