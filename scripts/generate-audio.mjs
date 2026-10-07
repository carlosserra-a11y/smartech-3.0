#!/usr/bin/env node
/**
 * Smartech 3.0 — gera a narração do guia de áudio com o Gemini TTS (gemini-3.8-flash-tts).
 *
 *   GEMINI_API_KEY=... node scripts/generate-audio.mjs          (gera os arquivos)
 *   node scripts/generate-audio.mjs --dry-run                    (mostra as requisições, sem chamar a API)
 *
 * Variáveis opcionais: GEMINI_TTS_MODEL (padrão gemini-3.8-flash-tts), GEMINI_TTS_VOICE (padrão Charon).
 * Saída: assets/audio/<capítulo>.wav (24 kHz, mono, 16 bits) e assets/audio/manifest.js,
 * que o player do site lê automaticamente. A chave fica só no seu computador.
 */
import { createRequire } from 'node:module';
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const script = require(join(root, 'js', 'audio-script.js'));

const API_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';
const MODEL = process.env.GEMINI_TTS_MODEL || script.MODEL;
const VOICE = process.env.GEMINI_TTS_VOICE || script.VOICE;
const DRY = process.argv.includes('--dry-run');
const KEY = process.env.GEMINI_API_KEY;
const OUT = join(root, 'assets', 'audio');

export function buildTtsPayload(text) {
  return {
    model: MODEL,
    input: [{ type: 'user_input', content: [{ type: 'text', text, annotations: [{ type: 'speech_metadata', style: script.STYLE }] }] }],
    response_format: { type: 'audio', mime_type: 'audio/wav', sample_rate: 24000 },
    generation_config: { speech_config: [{ voice: VOICE }] }
  };
}

/** Procura o último bloco de áudio (base64) nos steps da resposta. */
export function extractAudio(data) {
  const steps = (data && (data.steps || data.outputs)) || [];
  let found = null;
  for (const st of steps) {
    const output = (st && (st.model_output || (st.type === 'model_output' ? st : null))) || null;
    for (const c of (output && output.content) || []) if (c && c.type === 'audio' && typeof c.data === 'string') found = c.data;
  }
  return found;
}

/** Garante cabeçalho WAV (a API envia WAV em respostas unárias; PCM cru é embrulhado). */
export function toWav(buf, rate = 24000) {
  if (buf.slice(0, 4).toString('ascii') === 'RIFF') return buf;
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + buf.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22);
  h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(buf.length, 40);
  return Buffer.concat([h, buf]);
}

/** Duração (s) a partir do bloco "data" do WAV. */
export function wavSeconds(wav) {
  let off = 12;
  let rate = 24000, channels = 1, bits = 16;
  while (off + 8 <= wav.length) {
    const id = wav.slice(off, off + 4).toString('ascii');
    const size = wav.readUInt32LE(off + 4);
    if (id === 'fmt ') { channels = wav.readUInt16LE(off + 10); rate = wav.readUInt32LE(off + 12); bits = wav.readUInt16LE(off + 22); }
    if (id === 'data') return Math.round((size / (rate * channels * (bits / 8))) * 10) / 10;
    off += 8 + size + (size % 2);
  }
  return 0;
}

async function main() {
  if (DRY) {
    for (const c of script.CHAPTERS) console.log(JSON.stringify(buildTtsPayload(c.text)).slice(0, 220) + '…');
    console.log(`\n${script.CHAPTERS.length} capítulos · modelo ${MODEL} · voz ${VOICE} (simulação, nada foi enviado)`);
    return;
  }
  if (!KEY) { console.error('Defina GEMINI_API_KEY (ou rode com --dry-run).'); process.exit(1); }
  await mkdir(OUT, { recursive: true });
  const chapters = [];
  for (const c of script.CHAPTERS) {
    process.stdout.write(`→ ${c.title}… `);
    const r = await fetch(API_URL, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': KEY }, body: JSON.stringify(buildTtsPayload(c.text)) });
    if (!r.ok) { console.error(`\nErro ${r.status}: ${(await r.text()).slice(0, 400)}`); process.exit(1); }
    const b64 = extractAudio(await r.json());
    if (!b64) { console.error('\nResposta sem áudio.'); process.exit(1); }
    const wav = toWav(Buffer.from(b64, 'base64'));
    const file = `assets/audio/${c.id}.wav`;
    await writeFile(join(root, file), wav);
    const duration = wavSeconds(wav);
    chapters.push({ id: c.id, file, duration });
    console.log(`${duration}s`);
  }
  const manifest = { model: MODEL, voice: VOICE, generatedAt: new Date().toISOString(), chapters };
  await writeFile(join(OUT, 'manifest.js'), '/* Gerado por scripts/generate-audio.mjs — não edite à mão. */\nwindow.SMARTECH_AUDIO = ' + JSON.stringify(manifest, null, 2) + ';\n');
  console.log('\nPronto: assets/audio/manifest.js atualizado. Recarregue o site.');
}

if (process.argv[1] && fileURLToPath(import.meta.url).toLowerCase() === resolve(process.argv[1]).toLowerCase()) main();
