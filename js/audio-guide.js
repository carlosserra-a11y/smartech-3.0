/* Smartech 3.0 — audio-guide.js
 * Player do guia de áudio "A física da ozonólise".
 *  1. Se assets/audio/manifest.js listar os arquivos gerados pelo Gemini TTS → toca a narração gravada.
 *  2. Senão, se o navegador tiver síntese de voz → narra o mesmo roteiro com a voz pt-BR do sistema.
 *  3. Senão → só a transcrição.
 * A transcrição é sempre exibida (acessibilidade) e acompanha a narração.
 */
(function () {
  'use strict';

  var doc = document;
  var S = window.SmartechAudioScript;
  var root = doc.getElementById('audioGuide');
  if (!root || !S) return;

  function $(id) { return doc.getElementById(id); }
  var el = {
    play: $('audioPlay'), seek: $('audioSeek'), time: $('audioTime'), total: $('audioTotal'),
    chapter: $('audioChapter'), source: $('audioSource'), list: $('audioChapters'), text: $('audioTranscript'), audio: $('audioEl')
  };

  var manifest = window.SMARTECH_AUDIO;
  var hasFiles = !!(manifest && manifest.chapters && manifest.chapters.length === S.CHAPTERS.length);
  var synth = 'speechSynthesis' in window ? window.speechSynthesis : null;
  var mode = hasFiles ? 'file' : (synth ? 'speech' : 'text');

  /* ---------- linha do tempo (duração real dos arquivos ou estimada pela fala) ---------- */
  var chapters = S.CHAPTERS.map(function (c, i) {
    var dur = hasFiles && manifest.chapters[i].duration ? manifest.chapters[i].duration : S.estimateSeconds(c.text, 150);
    return { id: c.id, title: c.title, text: c.text, duration: dur, file: hasFiles ? manifest.chapters[i].file : null, sentences: S.sentences(c.text) };
  });
  var offset = 0;
  chapters.forEach(function (c) { c.start = offset; offset += c.duration; });
  var TOTAL = offset;

  // frases com início estimado proporcional ao número de palavras (modo voz do navegador)
  var flat = [];
  chapters.forEach(function (c, ci) {
    var words = S.wordCount(c.text) || 1;
    var t = c.start;
    c.sentences.forEach(function (s, si) {
      var d = c.duration * (S.wordCount(s) / words);
      flat.push({ ch: ci, si: si, text: s, start: t, duration: d });
      t += d;
    });
  });

  var state = { playing: false, ch: 0, idx: 0, elapsed: 0, token: 0, startedAt: 0, ticker: 0 };

  function fmtTime(s) { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }

  /* ---------- interface ---------- */
  function buildUi() {
    el.list.textContent = '';
    chapters.forEach(function (c, i) {
      var li = doc.createElement('li');
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'chapter-btn';
      b.dataset.ch = String(i);
      var n = doc.createElement('span'); n.className = 'chapter-btn__num'; n.textContent = String(i + 1).padStart(2, '0');
      var t = doc.createElement('span'); t.textContent = c.title;
      var d = doc.createElement('span'); d.className = 'chapter-btn__time'; d.textContent = fmtTime(c.duration);
      b.appendChild(n); b.appendChild(t); b.appendChild(d);
      b.addEventListener('click', function () { seekTo(c.start, true); });
      li.appendChild(b);
      el.list.appendChild(li);
    });

    el.text.textContent = '';
    chapters.forEach(function (c, ci) {
      var h = doc.createElement('h4'); h.textContent = (ci + 1) + ' · ' + c.title;
      var p = doc.createElement('p');
      c.sentences.forEach(function (s, si) {
        var span = doc.createElement('span');
        span.className = 's';
        span.dataset.k = ci + ':' + si;
        span.textContent = s + ' ';
        p.appendChild(span);
      });
      el.text.appendChild(h);
      el.text.appendChild(p);
    });

    el.total.textContent = fmtTime(TOTAL);
    if (mode === 'file') el.source.textContent = 'Narração por IA · ' + (manifest.model || S.MODEL) + ' · voz ' + (manifest.voice || S.VOICE);
    else if (mode === 'speech') el.source.textContent = 'Voz sintética do navegador · roteiro técnico Smartech';
    else el.source.textContent = 'Áudio indisponível neste navegador · leia a transcrição';

    if (mode !== 'text') { el.play.disabled = false; el.seek.disabled = false; }
    paint();
  }

  function currentTime() {
    if (mode === 'file') return chapters[state.ch].start + (el.audio.currentTime || 0);
    if (mode === 'speech') {
      var f = flat[state.idx] || flat[0];
      var into = state.playing ? Math.min(f.duration, (performance.now() - state.startedAt) / 1000) : 0;
      return f.start + into;
    }
    return 0;
  }

  function paint() {
    var t = currentTime();
    root.classList.toggle('is-playing', state.playing);
    el.play.setAttribute('aria-label', state.playing ? 'Pausar o guia de áudio' : 'Reproduzir o guia de áudio');
    el.chapter.textContent = 'Capítulo ' + (state.ch + 1) + ' · ' + chapters[state.ch].title;
    el.time.textContent = fmtTime(t);
    if (!seeking) el.seek.value = String(Math.round((t / TOTAL) * 1000));
    el.seek.style.setProperty('--pct', ((t / TOTAL) * 100).toFixed(1) + '%');
    Array.prototype.forEach.call(el.list.querySelectorAll('.chapter-btn'), function (b) {
      if (Number(b.dataset.ch) === state.ch) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
    });
  }

  function highlight() {
    var prev = el.text.querySelector('.s.is-current');
    if (prev) prev.classList.remove('is-current');
    if (mode !== 'speech' || !state.playing) return;
    var f = flat[state.idx];
    var span = f && el.text.querySelector('[data-k="' + f.ch + ':' + f.si + '"]');
    if (!span) return;
    span.classList.add('is-current');
    var details = el.text.closest('details');
    if (details && details.open) {           // rola só dentro da transcrição, nunca a página
      var top = span.offsetTop - el.text.offsetTop;
      if (top < el.text.scrollTop || top > el.text.scrollTop + el.text.clientHeight - 40) el.text.scrollTop = Math.max(0, top - 60);
    }
  }

  function startTicker() { stopTicker(); state.ticker = setInterval(paint, 250); }
  function stopTicker() { clearInterval(state.ticker); state.ticker = 0; }

  /* ---------- modo 1: arquivos gerados pelo Gemini TTS ---------- */
  function loadChapter(i, at, autoplay) {
    state.ch = i;
    var c = chapters[i];
    if (el.audio.dataset.ch !== String(i)) {
      el.audio.dataset.ch = String(i);
      el.audio.src = c.file;
    }
    var apply = function () {
      try { el.audio.currentTime = Math.max(0, Math.min(at || 0, (el.audio.duration || c.duration) - 0.1)); } catch (e) { /* metadados ainda não chegaram */ }
      if (autoplay) el.audio.play().catch(function () { state.playing = false; paint(); });
    };
    if (el.audio.readyState >= 1) apply(); else el.audio.addEventListener('loadedmetadata', apply, { once: true });
  }

  /* ---------- modo 2: síntese de voz do navegador ---------- */
  var voice = null;
  function pickVoice() {
    if (!synth) return;
    var voices = synth.getVoices();
    var pt = voices.filter(function (v) { return /^pt(-|_)BR/i.test(v.lang); });
    if (!pt.length) pt = voices.filter(function (v) { return /^pt/i.test(v.lang); });
    voice = pt.filter(function (v) { return /google|microsoft|natural|luciana|francisca|antonio|thalita/i.test(v.name); })[0] || pt[0] || null;
  }
  if (synth) { pickVoice(); if (synth.addEventListener) synth.addEventListener('voiceschanged', pickVoice); }

  function speakFrom(idx) {
    if (!synth) return;
    var token = ++state.token;
    synth.cancel();
    (function next(i) {
      if (token !== state.token) return;
      if (i >= flat.length) { state.playing = false; state.idx = 0; state.ch = 0; stopTicker(); highlight(); paint(); return; }
      state.idx = i;
      state.ch = flat[i].ch;
      state.startedAt = performance.now();
      var u = new SpeechSynthesisUtterance(flat[i].text);
      u.lang = 'pt-BR';
      if (voice) u.voice = voice;
      u.rate = 1;
      u.onend = function () { next(i + 1); };
      u.onerror = function (ev) { if (ev && (ev.error === 'interrupted' || ev.error === 'canceled')) return; next(i + 1); };
      highlight();
      paint();
      synth.speak(u);
    })(idx);
  }

  /* ---------- controles ---------- */
  function play() {
    if (mode === 'text') return;
    state.playing = true;
    if (mode === 'file') loadChapter(state.ch, el.audio.dataset.ch === String(state.ch) ? el.audio.currentTime : 0, true);
    else speakFrom(state.idx);
    startTicker();
    paint();
  }
  function pause() {
    state.playing = false;
    if (mode === 'file') el.audio.pause();
    else if (synth) { state.token++; synth.cancel(); }
    stopTicker();
    highlight();
    paint();
  }
  function seekTo(t, autoplay) {
    t = Math.max(0, Math.min(TOTAL - 0.5, t));
    if (mode === 'file') {
      var i = 0;
      while (i < chapters.length - 1 && t >= chapters[i + 1].start) i++;
      var wasPlaying = state.playing || autoplay;
      state.playing = wasPlaying;
      loadChapter(i, t - chapters[i].start, wasPlaying);
      if (wasPlaying) startTicker();
    } else if (mode === 'speech') {
      var k = 0;
      while (k < flat.length - 1 && t >= flat[k + 1].start) k++;
      state.idx = k;
      state.ch = flat[k].ch;
      if (state.playing || autoplay) { state.playing = true; speakFrom(k); startTicker(); }
    }
    paint();
  }

  el.play.addEventListener('click', function () { if (state.playing) pause(); else play(); });

  var seeking = false;
  el.seek.addEventListener('input', function () {
    seeking = true;
    var t = (Number(el.seek.value) / 1000) * TOTAL;
    el.time.textContent = fmtTime(t);
    el.seek.style.setProperty('--pct', (Number(el.seek.value) / 10).toFixed(1) + '%');
  });
  el.seek.addEventListener('change', function () {
    seeking = false;
    seekTo((Number(el.seek.value) / 1000) * TOTAL, false);
  });

  if (el.audio) {
    el.audio.addEventListener('ended', function () {
      if (state.ch < chapters.length - 1) loadChapter(state.ch + 1, 0, true);
      else { state.playing = false; state.ch = 0; el.audio.dataset.ch = ''; stopTicker(); paint(); }
    });
    el.audio.addEventListener('error', function () {
      if (mode !== 'file') return;
      // arquivo ausente/corrompido: cai para a voz do navegador sem perder a posição
      var t = currentTime();
      mode = synth ? 'speech' : 'text';
      el.source.textContent = synth ? 'Voz sintética do navegador · roteiro técnico Smartech' : 'Áudio indisponível · leia a transcrição';
      if (mode === 'text') { state.playing = false; el.play.disabled = true; paint(); return; }
      seekTo(t, state.playing);
    });
  }

  window.addEventListener('pagehide', function () { if (synth) synth.cancel(); });

  buildUi();
})();
