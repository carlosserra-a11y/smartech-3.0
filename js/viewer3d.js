/* Smartech 3.0 — viewer3d.js (carregador)
 * Decide quando e se o 3D deve ser carregado, e baixa tudo sob demanda:
 *  - three.js r147 + OrbitControls (CDN com versão fixa e SRI);
 *  - módulos do visualizador em js/3d/ (mesma origem).
 * Hero: carrega depois do "load", quando o navegador estiver ocioso.
 * Showroom: carrega quando a seção se aproxima da tela.
 * Sem WebGL ou com economia de dados: fica a ilustração e, se possível, um botão "Ativar 3D".
 */
(function () {
  'use strict';

  var doc = document;

  var CHAIN = [
    { url: 'https://cdn.jsdelivr.net/npm/three@0.147.0/build/three.min.js', integrity: 'sha384-vV17nr/rMaJqmeZkFUzXLpHdQ+ME5QHKdydaqqN+3Ga39RJlNrTatJxHwGV4ml2C' },
    { url: 'https://cdn.jsdelivr.net/npm/three@0.147.0/examples/js/controls/OrbitControls.js', integrity: 'sha384-I0DMsfimAPIqWT8lF+oA997gRgdUi3jhidoTq3fN0zmn35smXZukD01FLnsPRU9i' },
    { url: 'js/3d/materials.js' },
    { url: 'js/3d/parts.js' },
    { url: 'js/3d/components.js' },
    { url: 'js/3d/models.js' },
    { url: 'js/3d/viewer.js' },
    { url: 'js/3d/app.js' }
  ];

  var loading = null;

  function loadScript(item) {
    return new Promise(function (resolve, reject) {
      var s = doc.createElement('script');
      s.src = item.url;
      if (item.integrity) {
        s.integrity = item.integrity;
        s.crossOrigin = 'anonymous';
        s.referrerPolicy = 'no-referrer';
      }
      s.onload = resolve;
      s.onerror = function () { reject(new Error('Falha ao carregar ' + item.url)); };
      doc.head.appendChild(s);
    });
  }

  function loadAll() {
    if (window.Smartech3D && window.Smartech3D.createApp) return Promise.resolve();
    if (!loading) {
      loading = CHAIN.reduce(function (p, item) { return p.then(function () { return loadScript(item); }); }, Promise.resolve())
        .catch(function (err) { loading = null; throw err; });
    }
    return loading;
  }

  function webglSupported() {
    try {
      var c = doc.createElement('canvas');
      var gl = c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl');
      if (!gl) return false;
      var lose = gl.getExtension('WEBGL_lose_context');
      if (lose) lose.loseContext();
      return true;
    } catch (e) { return false; }
  }

  function saveData() {
    var c = navigator.connection;
    return !!(c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || '')));
  }

  function setStatus(el, text) {
    var t = el.querySelector('.viewer__status-text');
    if (t) t.textContent = text;
  }

  function boot(el, kind) {
    if (el.dataset.booted) return;
    el.dataset.booted = '1';
    el.classList.add('is-loading');
    setStatus(el, 'Carregando modelo 3D…');
    var btn = el.querySelector('.viewer__load');
    if (btn) btn.hidden = true;
    loadAll().then(function () {
      window.Smartech3D.createApp(el, kind);
    }).catch(function () {
      delete el.dataset.booted;
      el.classList.remove('is-loading');
      el.classList.add('is-fallback');
      setStatus(el, 'Não foi possível carregar o 3D agora.');
      if (btn) { btn.hidden = false; btn.textContent = 'Tentar novamente'; }
    });
  }

  function whenIdle(fn) {
    function run() {
      if ('requestIdleCallback' in window) window.requestIdleCallback(fn, { timeout: 2500 });
      else window.setTimeout(fn, 700);
    }
    if (doc.readyState === 'complete') run();
    else window.addEventListener('load', run, { once: true });
  }

  function mount(el, kind, eager) {
    var btn = el.querySelector('.viewer__load');
    if (!webglSupported()) {
      el.classList.add('is-fallback');
      setStatus(el, 'Seu dispositivo não suporta visualização 3D. Veja a ilustração e as fichas técnicas.');
      return;
    }
    if (btn) btn.addEventListener('click', function () { el.classList.remove('is-fallback'); boot(el, kind); });
    if (saveData()) { if (btn) btn.hidden = false; return; }
    if (eager) { whenIdle(function () { boot(el, kind); }); return; }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) { io.disconnect(); boot(el, kind); }
      }, { rootMargin: '700px 0px' });
      io.observe(el);
    } else boot(el, kind);
  }

  function init() {
    var hero = doc.getElementById('heroViewer');
    var main = doc.getElementById('mainViewer');
    if (hero) mount(hero, 'hero', true);
    if (main) mount(main, 'main', false);
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})();
