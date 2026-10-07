/* Smartech 3.0 — calculator.js
 * Liga a calculadora ao núcleo (calc-core.js): fórmula ao vivo, números animados,
 * relatório para o WhatsApp oficial, cópia do relatório e anexo ao formulário de orçamento.
 */
(function () {
  'use strict';

  var core = window.SmartechCalc;
  var doc = document;
  if (!core) return;

  var cfg = window.SMARTECH_CONFIG || {};
  var WA = String(cfg.whatsapp || doc.body.dataset.wa || '5548991809488').replace(/\D/g, '');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function $(id) { return doc.getElementById(id); }

  var el = {
    equip: $('c-equip'), hood: $('c-hood'), length: $('c-length'), width: $('c-width'), vel: $('c-vel'), dp: $('c-dp'),
    lengthOut: $('c-length-out'), widthOut: $('c-width-out'), velOut: $('c-vel-out'), dpOut: $('c-dp-out'), velRef: $('c-vel-ref'),
    formula: $('calcFormula'),
    q: $('r-q'), cfm: $('r-cfm'), area: $('r-area'), veff: $('r-veff'), gauge: $('r-gauge'),
    duct: $('r-duct'), ductTheo: $('r-duct-theo'), ductVel: $('r-vel'),
    cv: $('r-cv'), kw: $('r-kw'), shaft: $('r-shaft'),
    lamps: $('r-lamps'), lampsSplit: $('r-lamps-split'),
    report: $('calcReport'), copy: $('calcCopy'), toQuote: $('calcToQuote'), status: $('calcStatus'), live: $('calcLive')
  };
  if (!el.equip || !el.q) return;

  var current = null;
  var liveTimer = 0;

  function fmt(n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  var fmtInt = function (n) { return Math.round(n).toLocaleString('pt-BR'); };

  /** Anima o número até o novo valor (troca direto com "reduzir movimento"). */
  function setNum(node, value, format, animate) {
    if (!node) return;
    var from = parseFloat(node.dataset.value);
    node.dataset.value = String(value);
    if (node._raf) cancelAnimationFrame(node._raf);
    if (!animate || reduceMotion.matches || !isFinite(from) || from === value) { node.textContent = format(value); return; }
    var start = performance.now();
    (function step(now) {
      var t = Math.min(1, (now - start) / 460);
      var e = 1 - Math.pow(1 - t, 3);
      node.textContent = format(from + (value - from) * e);
      if (t < 1) node._raf = requestAnimationFrame(step);
      else node.textContent = format(value);
    })(start);
  }

  function paintRange(input) {
    var min = parseFloat(input.min), max = parseFloat(input.max), v = parseFloat(input.value);
    input.style.setProperty('--pct', (((v - min) / (max - min)) * 100).toFixed(1) + '%');
  }

  function formulaLine(sym, text) {
    var p = doc.createElement('p');
    var s = doc.createElement('span');
    s.textContent = sym;
    p.appendChild(s);
    p.appendChild(doc.createTextNode(' ' + text.replace(/^[AVQ] /, '')));
    return p;
  }

  function read() {
    return { equip: el.equip.value, hood: el.hood.value, length: el.length.value, width: el.width.value, velocity: el.vel.value, pressure: el.dp.value };
  }

  function render(animate) {
    var r = core.compute(read());
    if (!r.ok) return;
    current = r;
    var i = r.input;

    el.lengthOut.textContent = fmt(i.length, 2) + ' m';
    el.widthOut.textContent = fmt(i.width, 2) + ' m';
    el.velOut.textContent = fmt(i.velocity, 2) + ' m/s';
    el.dpOut.textContent = fmtInt(i.pressure) + ' Pa';
    el.velRef.textContent = fmt(core.LOADS[i.equip].velocity, 2) + ' m/s';
    [el.length, el.width, el.vel, el.dp].forEach(paintRange);

    el.formula.textContent = '';
    el.formula.appendChild(formulaLine('A', r.formula.area));
    el.formula.appendChild(formulaLine('V', r.formula.velocity));
    el.formula.appendChild(formulaLine('Q', r.formula.flow));

    setNum(el.q, r.airflowM3h, fmtInt, animate);
    setNum(el.cfm, r.airflowCfm, fmtInt, animate);
    el.area.textContent = fmt(r.area, 2);
    el.veff.textContent = core.formatVelocity(r.velocityEffective);
    el.gauge.style.width = Math.max(4, Math.min(100, (r.airflowM3h / 30000) * 100)).toFixed(1) + '%';

    setNum(el.duct, r.ductMm, fmtInt, animate);
    el.ductTheo.textContent = String(r.ductTheoreticalMm);
    el.ductVel.textContent = fmt(r.ductVelocity, 1);

    setNum(el.cv, r.motorCv, core.formatCv, animate);
    el.kw.textContent = fmt(r.motorKw, 2);
    el.shaft.textContent = fmt(r.shaftKw, 2);

    setNum(el.lamps, r.uvLamps, fmtInt, animate);
    el.lampsSplit.textContent = r.uv254 + ' × 254 nm · ' + r.uv185 + ' × 185 nm';

    clearTimeout(liveTimer);
    liveTimer = setTimeout(function () {
      el.live.textContent = 'Vazão ' + fmtInt(r.airflowM3h) + ' metros cúbicos por hora, duto de ' + r.ductMm +
        ' milímetros, motor de ' + core.formatCv(r.motorCv) + ' CV e ' + r.uvLamps + ' lâmpadas UV-C.';
    }, 700);
  }

  function say(text) {
    if (!el.status) return;
    el.status.textContent = text;
    clearTimeout(say._t);
    say._t = setTimeout(function () { el.status.textContent = ''; }, 6000);
  }

  function reportText() {
    var date = '';
    try { date = new Date().toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }); } catch (e) { date = new Date().toLocaleString('pt-BR'); }
    return core.report(current, { date: date });
  }

  function openExternal(url) {
    var a = doc.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    doc.body.appendChild(a);
    a.click();
    a.remove();
  }

  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function (resolve, reject) {
      var ta = doc.createElement('textarea');
      ta.value = text;
      ta.setAttribute('readonly', '');
      ta.className = 'sr-only';
      doc.body.appendChild(ta);
      ta.select();
      var ok = false;
      try { ok = doc.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove();
      if (ok) resolve(); else reject(new Error('copy'));
    });
  }

  // Equipamento novo → velocidade volta para a referência daquela carga térmica
  el.equip.addEventListener('change', function () {
    el.vel.value = String(core.LOADS[el.equip.value].velocity);
    render(true);
  });
  [el.hood, el.length, el.width, el.vel, el.dp].forEach(function (input) {
    input.addEventListener('input', function () { render(true); });
    input.addEventListener('change', function () { render(true); });
  });

  if (el.report) el.report.addEventListener('click', function () {
    if (!current) return;
    openExternal('https://wa.me/' + WA + '?text=' + encodeURIComponent(reportText()));
    say('Relatório aberto no WhatsApp da engenharia Smartech.');
  });

  if (el.copy) el.copy.addEventListener('click', function () {
    if (!current) return;
    copyText(reportText().replace(/\*/g, '')).then(function () { say('Relatório copiado.'); }, function () { say('Não foi possível copiar automaticamente.'); });
  });

  if (el.toQuote) el.toQuote.addEventListener('click', function () {
    if (!current) return;
    var airflow = $('f-airflow');
    var calc = $('f-calc');
    var status = $('formStatus');
    if (airflow) airflow.value = fmtInt(current.airflowM3h) + ' m³/h';
    if (calc) calc.value = core.describe(current);
    if (status) { status.className = 'form__status'; status.textContent = 'Pré-dimensionamento anexado ao formulário.'; }
    var contact = $('contact');
    if (contact) contact.scrollIntoView({ behavior: reduceMotion.matches ? 'auto' : 'smooth', block: 'start' });
    setTimeout(function () { var n = $('f-name'); if (n) n.focus({ preventScroll: true }); }, reduceMotion.matches ? 0 : 700);
  });

  render(false);
})();
