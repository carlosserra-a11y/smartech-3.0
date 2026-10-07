/* Smartech 3.0 — consultor.js
 * Interface do consultor técnico.
 *  - Com SMARTECH_CONFIG.consultorApi (Worker): pergunta ao Gemini com pesquisa Google e exibe
 *    a resposta, as fontes citadas e as "Search Suggestions" do Google (exigência dos termos de uso).
 *  - Sem a API, ou se ela falhar: responde pela base técnica local (consultor-core.js).
 * Nada vindo da IA é inserido como HTML na página: o texto vira nós de texto; as sugestões de
 * pesquisa do Google ficam isoladas num iframe sandbox, sem scripts.
 */
(function () {
  'use strict';

  var doc = document;
  var core = window.SmartechConsult;
  var section = doc.getElementById('consultor');
  if (!core || !section) return;

  var cfg = window.SMARTECH_CONFIG || {};
  var API = String(cfg.consultorApi || '').trim().replace(/\/+$/, '');
  var ONLINE = /^https:\/\//i.test(API);
  var TIMEOUT = Number(cfg.consultorTimeoutMs) || 25000;
  var WA = String(cfg.whatsapp || doc.body.dataset.wa || '5548991809488').replace(/\D/g, '');

  function $(id) { return doc.getElementById(id); }
  var el = { chat: section.querySelector('.consult__chat'), mode: $('consultMode'), log: $('consultLog'), form: $('consultForm'), input: $('consultInput'), send: $('consultSend'), suggest: $('consultSuggest') };
  if (!el.form || !el.log) return;

  var history = [];      // só nesta aba (não é gravado em lugar nenhum)
  var busy = false;

  if (ONLINE) {
    el.chat.classList.add('is-online');
    el.mode.textContent = 'IA Gemini com pesquisa Google · fontes citadas';
  } else {
    el.mode.textContent = 'Base técnica Smartech';
  }

  /* ---------- renderização segura ---------- */
  function renderParts(parent, parts) {
    parts.forEach(function (p) {
      if (p.t === 'b') { var b = doc.createElement('strong'); b.textContent = p.v; parent.appendChild(b); }
      else if (p.t === 'a' && core.isSafeUrl(p.href)) {
        var a = doc.createElement('a');
        a.href = p.href; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow'; a.textContent = p.v;
        parent.appendChild(a);
      } else parent.appendChild(doc.createTextNode(p.v));
    });
  }
  function renderBlocks(body, blocks) {
    blocks.forEach(function (bl) {
      if (bl.type === 'ul') {
        var ul = doc.createElement('ul');
        bl.items.forEach(function (it) { var li = doc.createElement('li'); renderParts(li, it); ul.appendChild(li); });
        body.appendChild(ul);
      } else {
        var p = doc.createElement('p');
        if (bl.type === 'h') { var s = doc.createElement('strong'); renderParts(s, bl.parts); p.appendChild(s); }
        else renderParts(p, bl.parts);
        body.appendChild(p);
      }
    });
  }

  function message(kind, who) {
    var wrap = doc.createElement('div');
    wrap.className = 'msg msg--' + kind;
    var w = doc.createElement('p');
    w.className = 'msg__who meta';
    w.textContent = who;
    var body = doc.createElement('div');
    body.className = 'msg__body';
    wrap.appendChild(w);
    wrap.appendChild(body);
    el.log.appendChild(wrap);
    return { wrap: wrap, body: body };
  }
  function scrollLog() { el.log.scrollTop = el.log.scrollHeight; }

  function typing() {
    var m = message('bot', ONLINE ? 'Consultor Smartech · pesquisando' : 'Consultor Smartech');
    m.wrap.classList.add('msg--typing');
    for (var i = 0; i < 3; i++) m.body.appendChild(doc.createElement('span'));
    scrollLog();
    return m.wrap;
  }

  function relatedButtons(wrap, entries) {
    if (!entries || !entries.length) return;
    var box = doc.createElement('div');
    box.className = 'msg__related';
    entries.forEach(function (e) {
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'text-btn';
      b.textContent = e.q;
      b.addEventListener('click', function () { ask(e.q); });
      box.appendChild(b);
    });
    wrap.appendChild(box);
  }

  function renderLocal(question, note) {
    var res = core.answerLocal(question);
    var m = message('bot', 'Consultor Smartech · base técnica');
    if (res.entry) {
      res.entry.answer.forEach(function (t) { var p = doc.createElement('p'); p.textContent = t; m.body.appendChild(p); });
      if (res.entry.link) {
        var a = doc.createElement('a'); a.href = res.entry.link.href; a.textContent = res.entry.link.text + ' →';
        var p2 = doc.createElement('p'); p2.appendChild(a); m.body.appendChild(p2);
      }
    } else {
      var p3 = doc.createElement('p');
      p3.textContent = 'Não encontrei isso na base técnica da Smartech. Reformule a pergunta ou fale com um engenheiro: ';
      var wa = doc.createElement('a');
      wa.href = 'https://wa.me/' + WA + '?text=' + encodeURIComponent('Olá! Tenho uma dúvida técnica: ' + question);
      wa.target = '_blank'; wa.rel = 'noopener noreferrer'; wa.textContent = 'WhatsApp técnico';
      p3.appendChild(wa);
      m.body.appendChild(p3);
    }
    if (note) { var n = doc.createElement('p'); n.className = 'msg__note'; n.textContent = note; m.wrap.appendChild(n); }
    relatedButtons(m.wrap, res.related);
    return res.entry ? res.entry.answer.join(' ') : '';
  }

  function renderOnline(data) {
    var m = message('bot', 'Consultor Smartech · Gemini + Google');
    renderBlocks(m.body, core.toBlocks(data.text));

    // "Search Suggestions" do Google: exibidas junto da resposta, sem modificação (termos do grounding)
    if (data.suggestionsHtml) {
      var frame = doc.createElement('iframe');
      frame.className = 'msg__search';
      frame.title = 'Sugestões de pesquisa do Google';
      frame.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      frame.setAttribute('referrerpolicy', 'no-referrer');
      frame.srcdoc = '<!doctype html><html><head><meta charset="utf-8"><base target="_blank"></head><body>' + String(data.suggestionsHtml) + '</body></html>';
      m.wrap.appendChild(frame);
    }
    if (data.sources && data.sources.length) {
      var src = doc.createElement('div');
      src.className = 'msg__sources';
      var h = doc.createElement('p'); h.textContent = 'Fontes'; src.appendChild(h);
      data.sources.forEach(function (s, i) {
        if (!core.isSafeUrl(s.url)) return;
        var a = doc.createElement('a');
        a.href = s.url; a.target = '_blank'; a.rel = 'noopener noreferrer nofollow';
        a.textContent = (i + 1) + ' · ' + (s.title || s.url);
        src.appendChild(a);
      });
      m.wrap.appendChild(src);
    }
  }

  function fetchJson(url, body) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, TIMEOUT);
    return fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl ? ctrl.signal : undefined,
      credentials: 'omit',
      referrerPolicy: 'strict-origin-when-cross-origin'
    }).then(function (r) {
      clearTimeout(timer);
      if (!r.ok) throw new Error('http_' + r.status);
      return r.json();
    }, function (e) { clearTimeout(timer); throw e; });
  }

  function ask(question) {
    question = String(question || '').trim().slice(0, 600);
    if (question.length < 3 || busy) return;
    busy = true;
    el.send.disabled = true;
    var u = message('user', 'Você');
    var p = doc.createElement('p'); p.textContent = question; u.body.appendChild(p);
    el.input.value = '';
    scrollLog();

    var done = function () { busy = false; el.send.disabled = false; scrollLog(); };

    if (!ONLINE) {
      var t = typing();
      setTimeout(function () {
        t.remove();
        renderLocal(question);
        done();
      }, 380);
      return;
    }

    var tw = typing();
    fetchJson(API + '/consultor', { question: question, history: history.slice(-6) }).then(function (data) {
      tw.remove();
      if (!data || !data.text) throw new Error('vazio');
      renderOnline(data);
      history.push({ role: 'user', text: question }, { role: 'model', text: String(data.text).slice(0, 1500) });
      if (history.length > 12) history = history.slice(-12);
      done();
    }).catch(function () {
      tw.remove();
      renderLocal(question, 'Não consegui consultar a IA agora; esta é a resposta da base técnica Smartech.');
      done();
    });
  }

  el.form.addEventListener('submit', function (e) { e.preventDefault(); ask(el.input.value); });
  el.input.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); ask(el.input.value); }
  });

  if (el.suggest) {
    core.suggestions(6).forEach(function (q) {
      var li = doc.createElement('li');
      var b = doc.createElement('button');
      b.type = 'button';
      b.className = 'text-btn';
      b.textContent = q;
      b.addEventListener('click', function () { ask(q); el.input.focus({ preventScroll: true }); });
      li.appendChild(b);
      el.suggest.appendChild(li);
    });
  }
})();
