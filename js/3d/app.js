/* Smartech 3.0 — 3d/app.js
 * Liga o visualizador à interface: modos, presets, ferramentas, gaveta com a ficha técnica,
 * lista de componentes, anotações 3D, HUD do Raio-X, telemetria e tela cheia.
 */
(function () {
  'use strict';

  var NS = window.Smartech3D;
  var doc = document;
  var mobileMQ = window.matchMedia('(max-width: 640px)');
  var HUD = { xray: 'Raio-X: câmara interna visível', cut: 'Corte frontal: seção ativa', solid: '' };

  function pad(n, l) { return String(Math.round(n)).padStart(l, '0'); }
  function fmt(n, d) { return Number(n).toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d }); }
  function el(tag, cls, text) {
    var e = doc.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  NS.createApp = function (root, kind) {
    var viewer = new NS.Viewer(root, { kind: kind });
    if (kind === 'main') wireMain(viewer, root); else wireHero(viewer, root);
    viewer.init();
    return viewer;
  };

  /* ---------------------------------------------------------------------- */
  function wireHero(viewer, root) {
    var chip = root.querySelector('.viewer__chip');
    viewer.on('ready', function () { if (chip) chip.hidden = false; });
    if (!chip) return;
    chip.addEventListener('click', function () {
      var next = chip.getAttribute('aria-pressed') !== 'true';
      chip.setAttribute('aria-pressed', String(next));
      viewer.setUv(next);
    });
  }

  /* ---------------------------------------------------------------------- */
  function wireMain(viewer, root) {
    function q(s) { return root.querySelector(s); }
    function qa(s, ctx) { return Array.prototype.slice.call((ctx || root).querySelectorAll(s)); }

    var label = doc.getElementById('modelLabel');
    var specList = doc.getElementById('specList');
    var list = doc.getElementById('componentList');
    var hud = doc.getElementById('viewerHud');
    var tele = doc.getElementById('viewerTelemetry');
    var layer = doc.getElementById('hotspotLayer');
    var drawer = doc.getElementById('componentDrawer');
    var modelBtns = qa('.model-btn', doc);
    var modeBtns = qa('[data-mode]');
    var presetBtns = qa('[data-preset]');
    var tools = {};
    qa('[data-action]').forEach(function (b) { tools[b.dataset.action] = b; });

    var order = [];           // componentes do modelo atual (ordem da lista)
    var spots = {};           // cid → botão da anotação
    var parts = {};           // cid → botão da lista
    var hoverName = '';
    var lastTrigger = null;

    /* ---- modos e presets ---- */
    modeBtns.forEach(function (b) { b.addEventListener('click', function () { viewer.setMode(b.dataset.mode); }); });
    viewer.on('mode', function (mode) {
      modeBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.mode === mode)); });
      hud.textContent = HUD[mode] || '';
    });
    presetBtns.forEach(function (b) { b.addEventListener('click', function () { viewer.goPreset(b.dataset.preset); }); });
    viewer.on('preset', function (name) {
      presetBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.preset === name)); });
    });

    /* ---- ferramentas ---- */
    var setters = {
      explode: function (v) { viewer.setExplode(v); },
      uv: function (v) { viewer.setUv(v); },
      smoke: function (v) { viewer.setSmoke(v); },
      hotspots: function (v) { viewer.setHotspots(v); },
      autorotate: function (v) { viewer.setAutoRotate(v); }
    };
    Object.keys(setters).forEach(function (name) {
      var b = tools[name];
      if (!b) return;
      b.addEventListener('click', function () { setters[name](b.getAttribute('aria-pressed') !== 'true'); });
    });
    viewer.on('toggle', function (t) {
      var b = tools[t.name];
      if (b) b.setAttribute('aria-pressed', String(t.value));
      if (t.name === 'hotspots') layer.hidden = !t.value;
    });
    if (tools.smoke) tools.smoke.setAttribute('aria-pressed', String(viewer.state.smoke));
    if (tools.autorotate) tools.autorotate.setAttribute('aria-pressed', String(viewer.state.autoRotate));
    if (tools['zoom-in']) tools['zoom-in'].addEventListener('click', function () { viewer.zoom(0.8); });
    if (tools['zoom-out']) tools['zoom-out'].addEventListener('click', function () { viewer.zoom(1.25); });
    if (tools.reset) tools.reset.addEventListener('click', function () { viewer.resetCamera(); });

    /* ---- telemetria ---- */
    viewer.on('hover', function (cid) { hoverName = cid && NS.COMPONENTS[cid] ? NS.COMPONENTS[cid].name : ''; });
    viewer.on('telemetry', function (t) {
      tele.textContent = 'AZ ' + pad(t.az, 3) + '° · EL ' + (t.el >= 0 ? '+' : '−') + pad(Math.abs(t.el), 2) + '° · ' + fmt(t.dist, 1) + ' m' + (hoverName ? ' · ' + hoverName : '');
    });

    /* ---- modelos ---- */
    modelBtns.forEach(function (b) {
      b.addEventListener('click', function () {
        var key = Number(b.dataset.model);
        modelBtns.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        if (key !== viewer.modelKey) viewer.setModel(key);
      });
    });

    function buildModelUi(key, model) {
      var info = NS.MODELS[key];
      if (label && info) label.textContent = info.label;
      if (specList && info) {
        specList.textContent = '';
        info.specs.forEach(function (row) {
          var d = el('div');
          d.appendChild(el('dt', '', row[0]));
          d.appendChild(el('dd', '', row[1]));
          specList.appendChild(d);
        });
      }
      order = model.hotspots.slice();
      spots = {};
      parts = {};

      list.textContent = '';
      layer.textContent = '';
      var hs = [];
      order.forEach(function (cid, i) {
        var c = NS.COMPONENTS[cid];
        var comp = model.components[cid];
        if (!c || !comp) return;
        var num = pad(i + 1, 2);

        var li = el('li');
        var pb = el('button', 'part-btn' + (comp.internal ? ' is-internal' : ''));
        pb.type = 'button';
        pb.appendChild(el('span', 'part-btn__num', num));
        pb.appendChild(el('span', 'part-btn__name', c.name));
        pb.appendChild(el('span', 'part-btn__note', c.note));
        pb.addEventListener('click', function () { lastTrigger = pb; viewer.select(cid); });
        li.appendChild(pb);
        list.appendChild(li);
        parts[cid] = pb;

        var hb = el('button', 'hotspot is-off' + (comp.internal ? ' is-internal' : ''));
        hb.type = 'button';
        hb.tabIndex = -1;
        hb.setAttribute('aria-label', c.name + ' — abrir ficha técnica');
        hb.appendChild(el('span', 'hotspot__dot', num));
        var lab = el('span', 'hotspot__label');
        lab.appendChild(el('span', '', c.name));
        lab.appendChild(el('small', '', c.note));
        hb.appendChild(lab);
        hb.addEventListener('click', function () { lastTrigger = hb; viewer.select(cid); });
        layer.appendChild(hb);
        spots[cid] = hb;
        hs.push({ cid: cid, el: hb, internal: comp.internal, off: true });
      });
      viewer.setHotspotElements(hs);
    }
    viewer.on('model', function (info) { closeDrawer(); buildModelUi(info.key, info.model); });

    /* ---- gaveta com a ficha técnica ---- */
    var dTitle = doc.getElementById('drawerTitle');
    var dKicker = doc.getElementById('drawerKicker');
    var dMeta = doc.getElementById('drawerMeta');
    var dText = doc.getElementById('drawerText');
    var dSpecs = doc.getElementById('drawerSpecs');
    var dNote = doc.getElementById('drawerNote');
    var dIndex = doc.getElementById('drawerIndex');

    function inset(open) {
      root.classList.toggle('has-drawer', !!open);
      if (!open) { viewer.setInset(0, 0); return; }
      if (mobileMQ.matches) viewer.setInset(0, Math.round(drawer.offsetHeight + 12));
      else viewer.setInset(Math.round(drawer.offsetWidth + 24), 0);
    }

    function openDrawer(cid) {
      var c = NS.COMPONENTS[cid];
      var comp = viewer.model && viewer.model.components[cid];
      if (!c || !comp) return;
      var idx = order.indexOf(cid);
      dKicker.textContent = (comp.internal ? 'Componente interno' : 'Componente externo') + ' · ' + pad(idx + 1, 2) + '/' + pad(order.length, 2);
      dTitle.textContent = c.name;
      dMeta.textContent = c.meta.join(' · ');
      dText.textContent = c.text;
      dSpecs.textContent = '';
      c.specs.forEach(function (row) {
        var d = el('div');
        d.appendChild(el('dt', '', row[0]));
        d.appendChild(el('dd', '', row[1]));
        dSpecs.appendChild(d);
      });
      dNote.textContent = c.footnote || '';
      dIndex.textContent = pad(idx + 1, 2) + ' / ' + pad(order.length, 2);
      var wasOpen = drawer.classList.contains('is-open');
      drawer.classList.add('is-open');
      drawer.removeAttribute('inert');
      drawer.setAttribute('aria-hidden', 'false');
      inset(true);
      Object.keys(spots).forEach(function (k) { spots[k].classList.toggle('is-selected', k === cid); });
      Object.keys(parts).forEach(function (k) { if (k === cid) parts[k].setAttribute('aria-current', 'true'); else parts[k].removeAttribute('aria-current'); });
      if (!wasOpen || doc.activeElement === lastTrigger) dTitle.focus({ preventScroll: true });
    }

    function closeDrawer() {
      if (!drawer.classList.contains('is-open')) return;
      var hadFocus = drawer.contains(doc.activeElement);
      drawer.classList.remove('is-open');
      drawer.setAttribute('inert', '');
      drawer.setAttribute('aria-hidden', 'true');
      inset(false);
      Object.keys(spots).forEach(function (k) { spots[k].classList.remove('is-selected'); });
      Object.keys(parts).forEach(function (k) { parts[k].removeAttribute('aria-current'); });
      if (hadFocus && lastTrigger && doc.contains(lastTrigger)) lastTrigger.focus({ preventScroll: true });
    }

    viewer.on('select', function (cid) { if (cid) openDrawer(cid); else closeDrawer(); });
    drawer.querySelector('[data-drawer-close]').addEventListener('click', function () { viewer.clearSelection(); });
    drawer.querySelector('[data-drawer-prev]').addEventListener('click', function () {
      var i = order.indexOf(viewer.state.selected);
      if (order.length) viewer.select(order[(i - 1 + order.length) % order.length]);
    });
    drawer.querySelector('[data-drawer-next]').addEventListener('click', function () {
      var i = order.indexOf(viewer.state.selected);
      if (order.length) viewer.select(order[(i + 1) % order.length]);
    });
    mobileMQ.addEventListener('change', function () { inset(drawer.classList.contains('is-open')); });

    /* ---- tela cheia (Fullscreen API) e modo imersivo (iPhone) ---- */
    function fsElement() { return doc.fullscreenElement || doc.webkitFullscreenElement || null; }
    function isFull() { return fsElement() === root || root.classList.contains('is-immersive'); }
    function syncFull() {
      var on = isFull();
      viewer.setImmersive(on);
      var b = tools.fullscreen;
      if (b) {
        b.setAttribute('aria-pressed', String(on));
        b.setAttribute('aria-label', on ? 'Sair da tela cheia' : 'Tela cheia');
        var use = b.querySelector('use');
        if (use) use.setAttribute('href', on ? '#i-minimize' : '#i-maximize');
      }
    }
    function immersive(on) {
      root.classList.toggle('is-immersive', on);
      doc.documentElement.classList.toggle('is-locked', on);
      syncFull();
    }
    function enterFull() {
      var req = root.requestFullscreen || root.webkitRequestFullscreen;
      if (!req) { immersive(true); return; }
      try {
        var p = req.call(root);
        if (p && p.catch) p.catch(function () { immersive(true); });
      } catch (e) { immersive(true); }
    }
    function exitFull() {
      if (root.classList.contains('is-immersive')) { immersive(false); return; }
      var ex = doc.exitFullscreen || doc.webkitExitFullscreen;
      if (fsElement() && ex) ex.call(doc);
    }
    if (tools.fullscreen) tools.fullscreen.addEventListener('click', function () { if (isFull()) exitFull(); else enterFull(); });
    doc.addEventListener('fullscreenchange', syncFull);
    doc.addEventListener('webkitfullscreenchange', syncFull);

    root.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (drawer.classList.contains('is-open')) { e.stopPropagation(); viewer.clearSelection(); }
      else if (root.classList.contains('is-immersive')) immersive(false);
    });
  }
})();
