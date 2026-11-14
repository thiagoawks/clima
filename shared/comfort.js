// Conforto térmico, usado pela janela e pelo processo principal (conforto automático).
// Cruza temperatura e umidade na "temperatura aparente" (Steadman / Bureau of Meteorology
// da Austrália, sem vento, como dentro de casa). Limites perto da zona de conforto da
// ASHRAE 55 (~26-27° com roupa leve), um pouco mais frescos à noite, e umidade de 65%+
// tratada como abafado.
(function (root) {
  const fmt1 = v => v.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  function comfort(t, rh, modes = []) {
    if (t == null) return null;
    const h = new Date().getHours();
    const night = h >= 22 || h < 6;
    const vapor = rh == null ? null : (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
    const at = vapor == null ? t : t + 0.33 * vapor - 4;
    const has = m => !modes || !modes.length || modes.includes(m);
    const sp = night ? 23 : 24;
    if (at >= (night ? 26 : 27))
      return { at, level: 'hot', label: 'Quente', why: `sensação de ${fmt1(at)}°`, action: { mode: 'cool', setpoint: sp, text: `Ligar no Frio a ${sp}°` } };
    if (rh != null && rh >= 65 && t >= 23)
      return { at, level: 'humid', label: 'Abafado', why: `umidade de ${rh}%`,
        action: has('dry') ? { mode: 'dry', setpoint: sp, text: 'Ligar no Seco' } : { mode: 'cool', setpoint: sp, text: `Ligar no Frio a ${sp}°` } };
    if (at <= 16 && has('heat'))
      return { at, level: 'cold', label: 'Frio', why: `sensação de ${fmt1(at)}°`, action: { mode: 'heat', setpoint: 22, text: 'Ligar no Quente a 22°' } };
    return { at, level: 'ok', label: 'Confortável', action: null };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { comfort };
  else root.comfort = comfort;
})(typeof self !== 'undefined' ? self : this);
