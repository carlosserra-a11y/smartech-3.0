/*!
 * Smartech 3.0 — calc-core.js
 * Pré-dimensionamento de exaustão (funções puras, sem DOM).
 * UMD: no navegador expõe window.SmartechCalc; no Node (tests/) usa module.exports.
 *
 *   Vazão ............ Q = A × V × 3600        (A = L × P em m², V em m/s, Q em m³/h)
 *   Duto ............. Ø para 10 m/s, arredondado ao diâmetro comercial acima
 *   Exaustor ......... P = Q · Δp / η  (+ folga) → motor comercial em CV e kW
 *   Bateria UV-C ..... 1 lâmpada a cada 1.000 m³/h, mínimo 2, sempre em pares (254 + 185 nm)
 *
 * Velocidades de captura e fatores de instalação são referências de mercado ajustáveis.
 * O dimensionamento final é validado em projeto com responsável técnico (NBR 14518).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmartechCalc = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /** Velocidade de captura de referência (m/s) por carga térmica do equipamento. */
  var LOADS = {
    parrilla: { label: 'Grelha / parrilla / carvão', load: 'pesada', velocity: 0.5 },
    chapa: { label: 'Chapa e fritadeiras', load: 'média-pesada', velocity: 0.4 },
    forno: { label: 'Forno combinado / fogão industrial', load: 'média', velocity: 0.3 },
    caldeira: { label: 'Caldeira / panela de cozimento', load: 'leve', velocity: 0.25 }
  };

  /** Fator k sobre a velocidade, conforme as faces abertas da coifa. */
  var HOODS = {
    parede: { label: 'Coifa de parede', factor: 1.0 },
    ilha: { label: 'Coifa de ilha (4 faces abertas)', factor: 1.25 },
    baixa: { label: 'Coifa baixa (close-coupled)', factor: 0.85 }
  };

  var LIMITS = { length: [1, 6], width: [0.8, 2.2], velocity: [0.15, 0.8], pressure: [200, 1000] };

  var SYSTEM = {
    ductVelocity: 10,       // m/s de projeto para o duto
    efficiency: 0.6,        // rendimento do conjunto motor + ventilador
    motorMargin: 1.15,      // folga sobre a potência de eixo
    wattsPerCv: 735.5,      // 1 CV = 735,5 W
    m3hPerCfm: 1.699,       // 1 CFM = 1,699 m³/h
    defaultPressure: 450,   // Pa — filtros + dutos + curvas (estimativa)
    uvFlowPerLamp: 1000,    // m³/h tratados por lâmpada UV-C (premissa)
    uvMinLamps: 2
  };

  var CV_COMMERCIAL = [0.5, 0.75, 1, 1.5, 2, 3, 4, 5, 7.5, 10, 12.5, 15, 20, 25, 30];
  var DUCT_COMMERCIAL_MM = [150, 175, 200, 225, 250, 300, 350, 400, 450, 500, 550, 600, 650, 700, 800, 900, 1000, 1200, 1400, 1600];

  function has(obj, key) { return Object.prototype.hasOwnProperty.call(obj, key); }
  function toNumber(v) { return typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.')); }
  function clamp(v, r) { return Math.min(r[1], Math.max(r[0], v)); }
  function round(v, d) { var f = Math.pow(10, d); return Math.round(v * f) / f; }
  /** Arredonda ao inteiro sem depender de resíduos de ponto flutuante (2524,4999… e 2524,5000…1 → 2525). */
  function roundStable(v) { return Math.round(Math.round(v * 1e6) / 1e6); }
  function isEmpty(v) { return v === undefined || v === null || v === ''; }
  function fmt(n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function fmtInt(n) { return Math.round(n).toLocaleString('pt-BR'); }
  /** 2 casas, ou 3 quando a terceira existe (0,625 m/s não vira "0,63" e a conta fecha). */
  function fmtVar(n) { return fmt(n, Math.abs(Math.round(n * 1000) % 10) ? 3 : 2); }
  function firstAtLeast(list, v) { for (var i = 0; i < list.length; i++) if (list[i] >= v) return list[i]; return undefined; }

  /**
   * @param {{equip:string, hood:string, length:number|string, width:number|string,
   *          velocity?:number|string, pressure?:number|string}} input
   */
  function compute(input) {
    input = input || {};
    if (!has(LOADS, input.equip)) return { ok: false, error: 'equip' };
    if (!has(HOODS, input.hood)) return { ok: false, error: 'hood' };

    var length = toNumber(input.length);
    var width = toNumber(input.width);
    var velocity = isEmpty(input.velocity) ? LOADS[input.equip].velocity : toNumber(input.velocity);
    var pressure = isEmpty(input.pressure) ? SYSTEM.defaultPressure : toNumber(input.pressure);
    if (![length, width, velocity, pressure].every(function (n) { return isFinite(n); })) return { ok: false, error: 'number' };

    length = clamp(length, LIMITS.length);
    width = clamp(width, LIMITS.width);
    velocity = clamp(velocity, LIMITS.velocity);
    pressure = Math.round(clamp(pressure, LIMITS.pressure));

    var factor = HOODS[input.hood].factor;
    var area = length * width;
    var vEff = velocity * factor;
    var airflowM3h = roundStable(area * vEff * 3600);                      // Q = A × V × 3600
    var airflowCfm = Math.round(airflowM3h / SYSTEM.m3hPerCfm);

    var ductArea = airflowM3h / 3600 / SYSTEM.ductVelocity;
    var ductTheoreticalMm = Math.round(Math.sqrt((4 * ductArea) / Math.PI) * 1000);
    var ductMm = firstAtLeast(DUCT_COMMERCIAL_MM, ductTheoreticalMm);
    if (ductMm === undefined) ductMm = Math.ceil(ductTheoreticalMm / 50) * 50;
    var ductVelocity = airflowM3h / 3600 / (Math.PI * Math.pow(ductMm / 1000, 2) / 4);

    var shaftW = (airflowM3h / 3600) * pressure / SYSTEM.efficiency;       // P = Q · Δp / η
    var cvNeeded = (shaftW * SYSTEM.motorMargin) / SYSTEM.wattsPerCv;
    var motorCv = firstAtLeast(CV_COMMERCIAL, cvNeeded);
    if (motorCv === undefined) motorCv = Math.ceil(cvNeeded);

    var uvLamps = Math.max(SYSTEM.uvMinLamps, Math.ceil(airflowM3h / SYSTEM.uvFlowPerLamp));
    if (uvLamps % 2) uvLamps += 1;

    var out = {
      ok: true,
      input: { equip: input.equip, hood: input.hood, length: length, width: width, velocity: velocity, pressure: pressure, factor: factor },
      area: round(area, 4),
      velocityEffective: round(vEff, 4),
      airflowM3h: airflowM3h,
      airflowCfm: airflowCfm,
      ductTheoreticalMm: ductTheoreticalMm,
      ductMm: ductMm,
      ductVelocity: round(ductVelocity, 1),
      shaftKw: round(shaftW / 1000, 2),
      motorCv: motorCv,
      motorKw: round((motorCv * SYSTEM.wattsPerCv) / 1000, 2),
      uvLamps: uvLamps,
      uv254: uvLamps / 2,
      uv185: uvLamps / 2
    };
    out.formula = {
      area: 'A = ' + fmt(length, 2) + ' m × ' + fmt(width, 2) + ' m = ' + fmt(area, 2) + ' m²',
      velocity: 'V = ' + fmt(velocity, 2) + ' m/s × ' + fmt(factor, 2) + ' = ' + fmtVar(vEff) + ' m/s',
      flow: 'Q = A × V × 3600 = ' + fmtInt(airflowM3h) + ' m³/h'
    };
    return out;
  }

  /** Resumo em uma linha (anexado ao formulário de orçamento). */
  function describe(r) {
    if (!r || !r.ok) return '';
    var i = r.input;
    return LOADS[i.equip].label + ' · ' + HOODS[i.hood].label + ' · ' + fmt(i.length, 2) + ' × ' + fmt(i.width, 2) + ' m · V ' +
      fmtVar(r.velocityEffective) + ' m/s · ' + fmtInt(r.airflowM3h) + ' m³/h (' + fmtInt(r.airflowCfm) + ' CFM) · duto Ø ' +
      r.ductMm + ' mm · motor ' + fmtCv(r.motorCv) + ' CV · ' + r.uvLamps + ' lâmpadas UV-C';
  }

  function fmtCv(cv) { return fmt(cv, cv % 1 ? (Math.round(cv * 100) % 10 ? 2 : 1) : 0); }

  /** Relatório completo para validação técnica (formatação do WhatsApp: *negrito*). */
  function report(r, opts) {
    if (!r || !r.ok) return '';
    opts = opts || {};
    var i = r.input;
    var lines = [
      '*Relatório de pré-dimensionamento — Smartech 3.0*',
      'Referência: ABNT NBR 14518' + (opts.date ? ' · gerado em ' + opts.date : ''),
      '',
      '*Entrada*',
      '· Equipamento: ' + LOADS[i.equip].label + ' (carga ' + LOADS[i.equip].load + ')',
      '· Instalação: ' + HOODS[i.hood].label + ' (k = ' + fmt(i.factor, 2) + ')',
      '· Área de captação: ' + r.formula.area,
      '· Velocidade de captura: ' + r.formula.velocity,
      '· Perda de carga estimada: ' + fmtInt(i.pressure) + ' Pa',
      '',
      '*Resultado*',
      '· Vazão: ' + r.formula.flow + ' (' + fmtInt(r.airflowCfm) + ' CFM)',
      '· Duto (' + SYSTEM.ductVelocity + ' m/s): Ø teórico ' + r.ductTheoreticalMm + ' mm → Ø comercial ' + r.ductMm + ' mm (' + fmt(r.ductVelocity, 1) + ' m/s)',
      '· Exaustor centrífugo: eixo ' + fmt(r.shaftKw, 2) + ' kW → motor ' + fmtCv(r.motorCv) + ' CV (' + fmt(r.motorKw, 2) + ' kW)',
      '· Bateria UV-C: ' + r.uvLamps + ' lâmpadas (' + r.uv254 + ' × 254 nm + ' + r.uv185 + ' × 185 nm)',
      '',
      'Premissas: η = ' + Math.round(SYSTEM.efficiency * 100) + '% · folga de ' + Math.round((SYSTEM.motorMargin - 1) * 100) + '% no motor · 1 lâmpada a cada ' + fmtInt(SYSTEM.uvFlowPerLamp) + ' m³/h.',
      'Solicito a validação técnica deste pré-dimensionamento.'
    ];
    return lines.join('\n');
  }

  return {
    compute: compute,
    describe: describe,
    report: report,
    formatCv: fmtCv,
    formatVelocity: fmtVar,
    LOADS: LOADS,
    HOODS: HOODS,
    LIMITS: LIMITS,
    SYSTEM: SYSTEM,
    CV_COMMERCIAL: CV_COMMERCIAL,
    DUCT_COMMERCIAL_MM: DUCT_COMMERCIAL_MM
  };
});
