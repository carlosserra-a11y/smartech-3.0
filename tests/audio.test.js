/* Testes do roteiro do guia de áudio e do gerador de narração.  node --test tests/audio.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const S = require('../js/audio-script.js');

const genUrl = pathToFileURL(path.join(__dirname, '..', 'scripts', 'generate-audio.mjs')).href;

test('roteiro: 5 capítulos com id, título e texto', () => {
  assert.equal(S.CHAPTERS.length, 5);
  const ids = new Set(S.CHAPTERS.map((c) => c.id));
  assert.equal(ids.size, 5);
  for (const c of S.CHAPTERS) {
    assert.ok(c.title.length > 5);
    assert.ok(S.wordCount(c.text) > 60, c.id);
  }
  assert.equal(S.MODEL, 'gemini-3.8-flash-tts');
});

test('a divisão em frases preserva números decimais (4,9 eV)', () => {
  const s = S.sentences('Em 254 nanômetros, isso dá cerca de 4,9 elétron-volts. É a fotólise! Pronto?');
  assert.deepEqual(s, ['Em 254 nanômetros, isso dá cerca de 4,9 elétron-volts.', 'É a fotólise!', 'Pronto?']);
  const all = S.CHAPTERS.map((c) => S.sentences(c.text).join(' ')).join(' ');
  assert.match(all, /4,9 elétron-volts/);
});

test('duração total estimada entre 3 e 5 minutos', () => {
  const total = S.CHAPTERS.reduce((t, c) => t + S.estimateSeconds(c.text, 150), 0);
  assert.ok(total > 180 && total < 300, String(total));
});

test('gerador: payload da Interactions API e extração do áudio', async () => {
  const g = await import(genUrl);
  const p = g.buildTtsPayload('Olá');
  assert.equal(p.model, 'gemini-3.8-flash-tts');
  assert.equal(p.input[0].type, 'user_input');
  assert.equal(p.input[0].content[0].annotations[0].type, 'speech_metadata');
  assert.deepEqual(p.response_format, { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 });
  assert.deepEqual(p.generation_config.speech_config, [{ voice: 'Charon' }]);
  const data = { steps: [{ type: 'model_output', content: [{ type: 'audio', data: 'AAAA' }, { type: 'audio', data: 'QkJC' }] }] };
  assert.equal(g.extractAudio(data), 'QkJC');
  assert.equal(g.extractAudio({}), null);
});

test('gerador: embrulha PCM em WAV e calcula a duração', async () => {
  const g = await import(genUrl);
  const pcm = Buffer.alloc(24000 * 2 * 3);               // 3 s de silêncio, 24 kHz, 16 bits, mono
  const wav = g.toWav(pcm);
  assert.equal(wav.slice(0, 4).toString('ascii'), 'RIFF');
  assert.equal(wav.length, pcm.length + 44);
  assert.equal(g.wavSeconds(wav), 3);
  assert.equal(g.toWav(wav), wav);                        // já é WAV: mantém
});
