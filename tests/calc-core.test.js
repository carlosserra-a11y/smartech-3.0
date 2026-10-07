/* Testes do núcleo de cálculo.  node --test tests/calc-core.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const calc = require('../js/calc-core.js');

const base = { equip: 'chapa', hood: 'parede', length: 2.5, width: 1.1 };

test('cenário padrão da página (valores iniciais do HTML)', () => {
  const r = calc.compute(base);
  assert.equal(r.ok, true);
  assert.equal(r.input.velocity, 0.4);              // velocidade de referência da carga média-pesada
  assert.equal(r.area, 2.75);
  assert.equal(r.airflowM3h, 3960);                 // Q = 2,75 × 0,40 × 3600
  assert.equal(r.airflowCfm, 2331);
  assert.equal(r.ductTheoreticalMm, 374);
  assert.equal(r.ductMm, 400);
  assert.equal(r.ductVelocity, 8.8);
  assert.equal(r.shaftKw, 0.83);
  assert.equal(r.motorCv, 1.5);
  assert.equal(r.motorKw, 1.1);
  assert.equal(r.uvLamps, 4);
  assert.equal(r.uv254, 2);
  assert.equal(r.uv185, 2);
});

test('Q = A × V × 3600 em todas as combinações', () => {
  for (const equip of Object.keys(calc.LOADS)) {
    for (const hood of Object.keys(calc.HOODS)) {
      const r = calc.compute({ ...base, equip, hood });
      const exact = 2.5 * 1.1 * calc.LOADS[equip].velocity * calc.HOODS[hood].factor * 3600;
      assert.ok(Math.abs(r.airflowM3h - exact) <= 0.5 + 1e-6, `${equip}/${hood}: ${r.airflowM3h} vs ${exact}`);
      assert.ok(Number.isInteger(r.airflowM3h));
    }
  }
});

test('velocidade e perda de carga informadas pelo usuário são respeitadas', () => {
  const r = calc.compute({ ...base, velocity: '0,35', pressure: 600 });
  assert.equal(r.input.velocity, 0.35);
  assert.equal(r.airflowM3h, Math.round(2.75 * 0.35 * 3600));
  assert.equal(r.input.pressure, 600);
});

test('potência do motor segue P = Q·Δp/η e é sempre um motor comercial suficiente', () => {
  for (const length of [1, 2, 3.5, 6]) {
    for (const width of [0.8, 1.4, 2.2]) {
      const r = calc.compute({ ...base, equip: 'parrilla', hood: 'ilha', length, width });
      const physicalCv = (r.airflowM3h / 3600 * r.input.pressure / calc.SYSTEM.efficiency) / calc.SYSTEM.wattsPerCv;
      assert.ok(r.motorCv >= physicalCv * calc.SYSTEM.motorMargin - 1e-9, 'motor menor que o necessário');
      assert.ok(calc.CV_COMMERCIAL.includes(r.motorCv) || Number.isInteger(r.motorCv));
      assert.ok(Math.abs(r.motorKw - r.motorCv * 0.7355) < 0.01);
    }
  }
});

test('duto comercial nunca é menor que o teórico e mantém a velocidade ≤ 10 m/s', () => {
  for (const length of [1, 1.7, 2.5, 4.4, 6]) {
    const r = calc.compute({ ...base, length });
    assert.ok(r.ductMm >= r.ductTheoreticalMm);
    assert.ok(r.ductVelocity <= calc.SYSTEM.ductVelocity + 0.05);
  }
});

test('lâmpadas UV-C: mínimo 2, sempre em pares, ~1 a cada 1.000 m³/h', () => {
  const small = calc.compute({ ...base, equip: 'caldeira', hood: 'baixa', length: 1, width: 0.8 });
  assert.equal(small.uvLamps, 2);
  const big = calc.compute({ ...base, equip: 'parrilla', hood: 'ilha', length: 6, width: 2.2 });
  assert.equal(big.uvLamps % 2, 0);
  assert.ok(big.uvLamps >= big.airflowM3h / 1000);
  assert.ok(big.uvLamps < big.airflowM3h / 1000 + 2);
});

test('entradas fora do intervalo são limitadas; inválidas retornam erro', () => {
  const r = calc.compute({ ...base, length: 999, width: -3, velocity: 9, pressure: 1 });
  assert.equal(r.input.length, 6);
  assert.equal(r.input.width, 0.8);
  assert.equal(r.input.velocity, 0.8);
  assert.equal(r.input.pressure, 200);
  assert.deepEqual(calc.compute({ ...base, equip: 'foguete' }), { ok: false, error: 'equip' });
  assert.deepEqual(calc.compute({ ...base, hood: '__proto__' }), { ok: false, error: 'hood' });
  assert.deepEqual(calc.compute({ ...base, length: 'abc' }), { ok: false, error: 'number' });
  assert.deepEqual(calc.compute(), { ok: false, error: 'equip' });
});

test('fórmula exibida e relatório do WhatsApp', () => {
  const r = calc.compute(base);
  assert.equal(r.formula.area, 'A = 2,50 m × 1,10 m = 2,75 m²');
  assert.equal(r.formula.velocity, 'V = 0,40 m/s × 1,00 = 0,40 m/s');
  assert.equal(r.formula.flow, 'Q = A × V × 3600 = 3.960 m³/h');
  const text = calc.report(r, { date: '06/10/2026 21:40' });
  assert.match(text, /Smartech 3\.0/);
  assert.match(text, /NBR 14518 · gerado em 06\/10\/2026 21:40/);
  assert.match(text, /Q = A × V × 3600 = 3\.960 m³\/h \(2\.331 CFM\)/);
  assert.match(text, /Ø teórico 374 mm → Ø comercial 400 mm \(8,8 m\/s\)/);
  assert.match(text, /motor 1,5 CV \(1,10 kW\)/);
  assert.match(text, /4 lâmpadas \(2 × 254 nm \+ 2 × 185 nm\)/);
  assert.equal(calc.report({ ok: false }), '');
});

test('velocidade efetiva com 3 casas quando necessário (a conta exibida fecha)', () => {
  const r = calc.compute({ ...base, equip: 'parrilla', hood: 'ilha' });
  assert.equal(r.formula.velocity, 'V = 0,50 m/s × 1,25 = 0,625 m/s');
  assert.equal(r.airflowM3h, 6188);                 // 2,75 × 0,625 × 3600 = 6.187,5
  assert.equal(calc.formatVelocity(0.4), '0,40');
});

test('formatação de CV e resumo para o orçamento', () => {
  assert.equal(calc.formatCv(0.75), '0,75');
  assert.equal(calc.formatCv(1.5), '1,5');
  assert.equal(calc.formatCv(2), '2');
  assert.match(calc.describe(calc.compute(base)), /3\.960 m³\/h \(2\.331 CFM\) · duto Ø 400 mm · motor 1,5 CV · 4 lâmpadas UV-C/);
});
