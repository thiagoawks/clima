// Mini janela: um ar por vez, sempre visível. Clicar no nome troca de ar.
const el = document.getElementById('mini');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const shortName = n => String(n || '').replace(/^ar[\s-]*condicionado\s*/i, '').trim() || n;
const M = { acs: [], idx: 0, picked: false };
let sendTimer = null;

async function applySettings() {
  const s = await window.api.getSettings();
  const dark = s.theme === 'dark' || (s.theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  if (!M.picked && s.hotkeyDevice) {
    const i = M.acs.findIndex(d => d.id === s.hotkeyDevice);
    if (i >= 0) M.idx = i;
  }
  render();
}
function setData(data) {
  const cur = M.acs[M.idx]?.id;
  M.acs = (data?.devices || []).filter(d => d.kind === 'ac' && !d.offline);
  const i = M.acs.findIndex(d => d.id === cur);
  M.idx = i >= 0 ? i : Math.min(M.idx, Math.max(0, M.acs.length - 1));
  render();
}
function render() {
  const d = M.acs[M.idx];
  if (!d) {
    el.innerHTML = `<div class="m-top"><div class="m-sub">Abra o Clima para conectar.</div><button class="m-x" data-a="close" aria-label="Fechar mini janela">×</button></div>`;
    return;
  }
  const amb = [d.temp != null ? `${Math.round(d.temp)}°` : null, d.humidity != null ? `${d.humidity}%` : null].filter(Boolean).join(' · ');
  el.innerHTML = `
    <div class="m-top">
      <button data-a="next" aria-label="Trocar de ar" style="min-width:0"><div class="m-name">${esc(shortName(d.name))}</div><div class="m-sub" style="text-align:left">${d.on ? 'Ligado' : 'Desligado'}${amb ? ` · ambiente ${amb}` : ''}</div></button>
      <button class="m-x" data-a="close" aria-label="Fechar mini janela">×</button>
    </div>
    <div class="m-row">
      <div class="m-temp${d.on ? '' : ' off'}">${d.on && d.setpoint != null ? `${d.setpoint}°` : '—'}</div>
      <div class="m-btns">
        <button class="m-round" data-a="down" aria-label="Diminuir temperatura" ${!d.on || d.setpoint <= d.min ? 'disabled' : ''}>−</button>
        <button class="m-round" data-a="up" aria-label="Aumentar temperatura" ${!d.on || d.setpoint >= d.max ? 'disabled' : ''}>+</button>
        <button class="toggle" role="switch" aria-checked="${d.on}" aria-label="Ligar ou desligar" data-a="power"></button>
      </div>
    </div>`;
}
const one = (capability, command, args = []) => [{ component: 'main', capability, command, arguments: args }];
el.addEventListener('click', async e => {
  const b = e.target.closest('[data-a]');
  if (!b || b.disabled) return;
  const d = M.acs[M.idx];
  const a = b.dataset.a;
  if (a === 'close') return window.api.close();
  if (!d) return;
  if (a === 'next') { M.idx = (M.idx + 1) % M.acs.length; M.picked = true; return render(); }
  if (a === 'power') {
    d.on = !d.on; render();
    try { await window.api.command({ id: d.id, commands: one('switch', d.on ? 'on' : 'off') }); } catch {}
  }
  if (a === 'up' || a === 'down') {
    d.setpoint = Math.min(d.max, Math.max(d.min, d.setpoint + (a === 'up' ? 1 : -1)));
    render();
    clearTimeout(sendTimer);
    sendTimer = setTimeout(() => window.api.command({ id: d.id, commands: one('thermostatCoolingSetpoint', 'setCoolingSetpoint', [d.setpoint]) }).catch(() => {}), 600);
  }
});
el.addEventListener('dblclick', e => { if (!e.target.closest('[data-a]')) window.api.showMain(); });

window.api.onData(setData);
window.api.onSettings(applySettings);
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applySettings);
(async () => { setData(await window.api.cached()); await applySettings(); })();
