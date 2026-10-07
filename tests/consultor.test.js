/* Testes do consultor: base técnica local, renderização segura e Worker do Gemini.
 * node --test tests/consultor.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const core = require('../js/consultor-core.js');

const workerUrl = pathToFileURL(path.join(__dirname, '..', 'worker', 'consultor-worker.js')).href;

/* ---------------- base técnica local ---------------- */
test('encontra a resposta certa na base técnica (com e sem acentos)', () => {
  const cases = [
    ['Qual a diferença entre 254 e 185 nanômetros?', 'uv-254-185'],
    ['o ozonio pode fazer mal pra equipe?', 'ozonio-seguranca'],
    ['como calcular a vazão da coifa', 'vazao-calculo'],
    ['de quanto em quanto tempo lavar os filtros', 'manutencao'],
    ['inox 430 serve?', 'inox-304'],
    ['o que significa IP65', 'ip65'],
    ['quanto custa uma coifa?', 'orcamento'],
    ['pra onde vai a gordura da canaleta', 'dreno']
  ];
  for (const [q, id] of cases) {
    const r = core.answerLocal(q);
    assert.ok(r.entry, `sem resposta para: ${q}`);
    assert.equal(r.entry.id, id, q);
    assert.ok(r.related.length >= 1);
    assert.ok(!r.related.includes(r.entry));
  }
});

test('pergunta fora do escopo não inventa resposta', () => {
  const r = core.answerLocal('qual a cor preferida do engenheiro?');
  assert.equal(r.entry, null);
  assert.equal(r.related.length, 3);
});

test('toBlocks converte markdown simples sem gerar HTML', () => {
  const blocks = core.toBlocks('**Resumo:** a NBR 14518 trata de ventilação.\n\n- item um\n- item [dois](https://abnt.org.br)\n\n### Título');
  assert.equal(blocks[0].type, 'p');
  assert.deepEqual(blocks[0].parts[0], { t: 'b', v: 'Resumo:' });
  assert.equal(blocks[1].type, 'ul');
  assert.equal(blocks[1].items.length, 2);
  assert.deepEqual(blocks[1].items[1][1], { t: 'a', v: 'dois', href: 'https://abnt.org.br' });
  assert.equal(blocks[2].type, 'h');
  const evil = core.toBlocks('<img src=x onerror=alert(1)> [x](javascript:alert(1))');
  assert.equal(evil[0].parts.length, 1);                 // fica como texto puro
  assert.equal(evil[0].parts[0].t, 'text');
  assert.equal(core.isSafeUrl('javascript:alert(1)'), false);
  assert.equal(core.isSafeUrl('https://www.gov.br/'), true);
});

/* ---------------- Worker ---------------- */
const SAMPLE = {
  id: 'abc',
  steps: [
    { type: 'user_input', content: [{ type: 'text', text: 'pergunta' }] },
    { type: 'google_search_call', arguments: { queries: ['NBR 14518 coifa requisitos'] } },
    { type: 'google_search_result', result: [{ search_suggestions: '<div class="chip">NBR 14518</div>' }] },
    {
      type: 'model_output',
      content: [{
        type: 'text',
        text: 'A NBR 14518 trata de sistemas de ventilação para cozinhas profissionais.',
        annotations: [
          { type: 'url_citation', url: 'https://www.abnt.org.br/x', title: 'ABNT', start_index: 0, end_index: 10 },
          { url_citation: { url: 'https://exemplo.com/y', title: '' } },
          { type: 'url_citation', url: 'javascript:alert(1)', title: 'mal' },
          { type: 'url_citation', url: 'https://www.abnt.org.br/x', title: 'duplicada' }
        ]
      }]
    }
  ]
};

test('parseInteraction lê texto, fontes, consultas e Search Suggestions', async () => {
  const w = await import(workerUrl);
  const r = w.parseInteraction(SAMPLE);
  assert.match(r.text, /NBR 14518/);
  assert.deepEqual(r.queries, ['NBR 14518 coifa requisitos']);
  assert.equal(r.suggestionsHtml, '<div class="chip">NBR 14518</div>');
  assert.deepEqual(r.sources, [{ url: 'https://www.abnt.org.br/x', title: 'ABNT' }, { url: 'https://exemplo.com/y', title: 'exemplo.com' }]);
  assert.deepEqual(w.parseInteraction({}), { text: '', sources: [], queries: [], suggestionsHtml: '' });
});

test('buildPayload: grounding com Google Search, sem armazenamento, histórico sem estado', async () => {
  const w = await import(workerUrl);
  const p = w.buildPayload('E o ozônio?', w.sanitizeHistory([{ role: 'user', text: 'oi' }, { role: 'model', text: 'olá' }, { role: 'hacker', text: 'x' }]));
  assert.equal(p.model, 'gemini-3.8-flash');
  assert.deepEqual(p.tools, [{ type: 'google_search' }]);
  assert.equal(p.store, false);
  assert.match(p.system_instruction, /NBR 14518/);
  assert.deepEqual(p.input.map((s) => s.type), ['user_input', 'model_output', 'user_input']);
  assert.equal(p.input[2].content[0].text, 'E o ozônio?');
});

function req(method, body, origin) {
  const headers = { 'Content-Type': 'application/json' };
  if (origin) headers.Origin = origin;
  return new Request('https://smartech-consultor.exemplo.workers.dev/consultor', { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
}
const ENV = { GEMINI_API_KEY: 'chave-de-teste', ALLOWED_ORIGINS: 'https://carlosserra-a11y.github.io, http://127.0.0.1:5180' };

test('CORS: só origens permitidas; preflight responde 204', async () => {
  const w = (await import(workerUrl)).default;
  const ok = await w.fetch(req('OPTIONS', undefined, 'https://carlosserra-a11y.github.io'), ENV);
  assert.equal(ok.status, 204);
  assert.equal(ok.headers.get('Access-Control-Allow-Origin'), 'https://carlosserra-a11y.github.io');
  const bad = await w.fetch(req('POST', { question: 'teste de pergunta' }, 'https://site-estranho.com'), ENV);
  assert.equal(bad.status, 403);
  assert.equal(bad.headers.get('Access-Control-Allow-Origin'), null);
});

test('validação de entrada e configuração ausente', async () => {
  const w = (await import(workerUrl)).default;
  const o = 'http://127.0.0.1:5180';
  assert.equal((await w.fetch(req('POST', { question: 'oi' }, o), ENV)).status, 400);
  assert.equal((await w.fetch(req('POST', { question: 'x'.repeat(700) }, o), ENV)).status, 400);
  assert.equal((await w.fetch(req('GET', undefined, o), ENV)).status, 405);
  assert.equal((await w.fetch(req('POST', { question: 'pergunta válida' }, o), { ALLOWED_ORIGINS: o })).status, 500);
});

test('fluxo completo com a API do Gemini simulada', async () => {
  const w = (await import(workerUrl)).default;
  const realFetch = global.fetch;
  let sent = null;
  global.fetch = async (url, init) => {
    sent = { url, init };
    return new Response(JSON.stringify(SAMPLE), { status: 200, headers: { 'Content-Type': 'application/json' } });
  };
  try {
    const res = await w.fetch(req('POST', { question: 'O que a NBR 14518 exige?', history: [] }, 'https://carlosserra-a11y.github.io'), Object.assign({}, ENV, { GEMINI_MODEL: 'gemini-3.8-flash' }));
    assert.equal(res.status, 200);
    assert.equal(res.headers.get('Cache-Control'), 'no-store');
    const data = await res.json();
    assert.match(data.text, /ventilação/);
    assert.equal(data.sources.length, 2);
    assert.equal(sent.url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(sent.init.headers['x-goog-api-key'], 'chave-de-teste');
    const payload = JSON.parse(sent.init.body);
    assert.deepEqual(payload.tools, [{ type: 'google_search' }]);
  } finally {
    global.fetch = realFetch;
  }
});
