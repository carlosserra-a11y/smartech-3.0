/* Smartech 3.0 — 3d/viewer.js
 * Motor do visualizador: cena, câmera, OrbitControls, presets, modos (sólido / raio-X / corte),
 * vista explodida, UV-C, fumaça, seleção por clique, isolamento, anotações 3D e telemetria.
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var NS = window.Smartech3D;
  var RO = NS.RENDER_ORDER;
  var doc = document;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function easeInOutCubic(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function damp(cur, target, rate, dt) {
    var d = target - cur;
    if (Math.abs(d) < 0.0008) return target;
    return cur + d * (1 - Math.exp(-rate * dt));
  }

  function radialTexture(stops) {
    var c = doc.createElement('canvas');
    c.width = c.height = 128;
    var ctx = c.getContext('2d');
    var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    stops.forEach(function (s) { g.addColorStop(s[0], s[1]); });
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(c);
  }

  /* ---------------- fumaça (partículas com sprite suave) ---------------- */
  function createSmoke(cfg, count, tex) {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(count * 3);
    var col = new Float32Array(count * 3);
    var speed = new Float32Array(count);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    var mat = new THREE.PointsMaterial({ size: 0.78, map: tex, vertexColors: true, transparent: true, opacity: 0.3, depthWrite: false, sizeAttenuation: true });
    var points = new THREE.Points(geo, mat);
    points.frustumCulled = false;
    points.renderOrder = RO.smoke;
    function reset(i, scatter) {
      pos[i * 3] = cfg.cx + (Math.random() - 0.5) * 2 * cfg.hw;
      pos[i * 3 + 1] = scatter ? cfg.y0 + Math.random() * (cfg.yTop - cfg.y0) : cfg.y0 + Math.random() * 0.15;
      pos[i * 3 + 2] = cfg.cz + (Math.random() - 0.5) * 2 * cfg.hd;
      speed[i] = 0.5 + Math.random() * 0.35;
    }
    for (var i = 0; i < count; i++) reset(i, true);
    return {
      points: points,
      update: function (dt, uvOn) {
        var pull = Math.min(1, dt * 1.7);
        for (var k = 0; k < count; k++) {
          var j = k * 3;
          pos[j + 1] += speed[k] * dt;
          var y = pos[j + 1];
          if (y > cfg.yFilter) {
            pos[j] += (cfg.collarX - pos[j]) * pull;
            pos[j + 2] += (cfg.collarZ - pos[j + 2]) * pull;
            if (uvOn) { col[j] = 0.62; col[j + 1] = 0.5; col[j + 2] = 1.0; }
            else { col[j] = 0.5; col[j + 1] = 0.47; col[j + 2] = 0.42; }
          } else { col[j] = 0.66; col[j + 1] = 0.66; col[j + 2] = 0.64; }
          if (y > cfg.yTop) reset(k, false);
        }
        geo.attributes.position.needsUpdate = true;
        geo.attributes.color.needsUpdate = true;
      },
      dispose: function () { geo.dispose(); mat.dispose(); }
    };
  }

  /* ====================================================================== */
  function Viewer(el, opts) {
    opts = opts || {};
    this.el = el;
    this.kind = opts.kind || 'main';
    this.host = el.querySelector('.viewer__canvas');
    this.statusText = el.querySelector('.viewer__status-text');
    var main = this.kind === 'main';
    this.state = {
      mode: 'solid', explode: false, uv: false,
      smoke: !main || !reduceMotion.matches,
      hotspots: main,
      autoRotate: !main && !reduceMotion.matches,
      selected: null
    };
    this.levels = { xray: 0, cut: 0, explode: 0, uv: 0 };
    this.listeners = {};
    this.hotspotEls = [];
    this.inset = { right: 0, bottom: 0 };
    this.pendingModel = 1;
    this.visible = false;
    this.ratio = 0;
    this.running = false;
    this.ready = false;
    this.introDone = !main;
    this.camAnim = null;
    this.last = 0;
    this.telemetryAt = 0;
    this.tick = this.tick.bind(this);
    this._v = new THREE.Vector3();
    this._sph = new THREE.Spherical();
  }

  Viewer.prototype.on = function (evt, fn) { (this.listeners[evt] = this.listeners[evt] || []).push(fn); };
  Viewer.prototype.emit = function (evt, data) { (this.listeners[evt] || []).forEach(function (fn) { fn(data); }); };
  Viewer.prototype.setStatus = function (t) { if (this.statusText) this.statusText.textContent = t; };

  /* ---------------- inicialização ---------------- */
  Viewer.prototype.init = function () {
    var self = this;
    var w = this.host.clientWidth || 600;
    var h = this.host.clientHeight || 400;
    var main = this.kind === 'main';

    var r = this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.matchMedia('(max-width: 640px)').matches ? 1.5 : 2));
    r.setSize(w, h, false);
    r.outputEncoding = THREE.sRGBEncoding;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.95;
    r.setClearColor(0x000000, 0);
    r.localClippingEnabled = true;                     // corte frontal por plano de recorte
    this.host.appendChild(r.domElement);

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(32, w / h, 0.05, 120);
    this.camera.position.set(4, 1, 6);
    this.cutPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 1e4);   // 1e4 = sem corte

    this.buildEnvironment();
    var key = new THREE.DirectionalLight(0xffffff, 0.7);
    key.position.set(3, 5, 4);
    this.scene.add(key);
    var rim = new THREE.PointLight(0x38bdf8, 1.1, 14, 1.5);
    rim.position.set(-4, 1.2, -3);
    this.scene.add(rim);

    this.tubeOff = new THREE.Color(0xdbe2ea);
    this.tubeOn = new THREE.Color(0xf3e8ff);
    this.glowTex = radialTexture([[0, 'rgba(255,255,255,0.9)'], [0.4, 'rgba(255,255,255,0.35)'], [1, 'rgba(255,255,255,0)']]);
    this.smokeTex = radialTexture([[0, 'rgba(255,255,255,0.85)'], [0.5, 'rgba(255,255,255,0.3)'], [1, 'rgba(255,255,255,0)']]);
    this.stage = this.buildStage();
    this.scene.add(this.stage);

    var c = this.controls = new THREE.OrbitControls(this.camera, r.domElement);
    c.enableDamping = true;
    c.dampingFactor = 0.08;
    c.screenSpacePanning = true;
    c.enablePan = main;
    c.enableZoom = false;                   // roda do mouse rola a página; zoom pelos botões (ou livre em tela cheia)
    c.rotateSpeed = 0.7;
    c.panSpeed = 0.8;
    c.minPolarAngle = 0.12;
    c.maxPolarAngle = Math.PI * 0.72;
    c.autoRotate = this.state.autoRotate;
    c.autoRotateSpeed = 1.2;
    r.domElement.style.touchAction = 'pan-y';
    c.addEventListener('start', function () { self.camAnim = null; self.userMoved = true; self.emit('preset', null); });

    if (main) this.bindPicking();
    this.host.addEventListener('keydown', function (e) {
      var handled = true;
      if (e.key === 'ArrowLeft') self.rotateBy(-0.26);
      else if (e.key === 'ArrowRight') self.rotateBy(0.26);
      else if (e.key === 'ArrowUp' || e.key === '+' || e.key === '=') self.zoom(0.85);
      else if (e.key === 'ArrowDown' || e.key === '-' || e.key === '_') self.zoom(1.18);
      else if (e.key === 'Home') self.resetCamera();
      else handled = false;
      if (handled) e.preventDefault();
    });

    r.domElement.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      self.stop();
      self.ready = false;
      self.el.classList.remove('is-ready');
      self.el.classList.add('is-fallback');
      self.setStatus('A visualização 3D foi interrompida pelo dispositivo.');
    });
    r.domElement.addEventListener('webglcontextrestored', function () {
      self.el.classList.remove('is-fallback');
      self.start();
    });

    if ('ResizeObserver' in window) {
      this.ro = new ResizeObserver(function () { self.resize(); });
      this.ro.observe(this.host);
    } else {
      window.addEventListener('resize', function () { self.resize(); });
    }
    this.io = new IntersectionObserver(function (entries) {
      var en = entries[entries.length - 1];
      self.visible = en.isIntersecting;
      self.ratio = en.intersectionRatio;
      if (self.visible) self.start(); else self.stop();
      self.checkIntro();
    }, { threshold: [0, 0.35] });
    this.io.observe(this.el);
    doc.addEventListener('visibilitychange', function () { if (doc.hidden) self.stop(); else if (self.visible) self.start(); });

    this.setModel(this.pendingModel);
  };

  Viewer.prototype.buildEnvironment = function () {
    var env = new THREE.Scene();
    env.add(new THREE.Mesh(new THREE.BoxGeometry(14, 9, 14), new THREE.MeshBasicMaterial({ color: 0x0c1216, side: THREE.BackSide })));
    function panel(w, h, color, intensity, x, y, z) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
      m.position.set(x, y, z);
      m.lookAt(0, 0, 0);
      env.add(m);
    }
    panel(5, 2.6, 0xffffff, 3.2, 0, 4.2, 0);
    panel(2.6, 2.6, 0xfff4d6, 6.5, -5.5, 1.2, 3);
    panel(2.4, 2, 0xcfe9ff, 3, 5.5, 0.8, -1.5);
    panel(8, 1, 0xffffff, 1.8, 0, 0.5, -6);
    panel(4, 1.2, 0xfacc15, 1.2, 0, -1.6, 6);
    var pmrem = new THREE.PMREMGenerator(this.renderer);
    var rt = pmrem.fromScene(env, 0.035);
    this.scene.environment = rt.texture;
    this.envRT = rt;
    pmrem.dispose();
    env.traverse(function (o) { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  };

  Viewer.prototype.buildStage = function () {
    var g = new THREE.Group();
    var shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({
      map: radialTexture([[0, 'rgba(0,0,0,0.6)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false
    }));
    shadow.rotation.x = -Math.PI / 2;
    g.add(shadow);
    [[1.0, 1.012, 0x38bdf8, 0.5], [1.28, 1.285, 0xfacc15, 0.25]].forEach(function (rr) {
      var m = new THREE.Mesh(new THREE.RingGeometry(rr[0], rr[1], 96), new THREE.MeshBasicMaterial({ color: rr[2], transparent: true, opacity: rr[3], side: THREE.DoubleSide, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 0.002;
      g.add(m);
    });
    return g;
  };

  /* ---------------- modelo ---------------- */
  Viewer.prototype.setModel = function (key) {
    if (!this.renderer) { this.pendingModel = key; return; }
    this.clearSelection(true);
    if (this.model) { this.scene.remove(this.model.group); this.model.dispose(); }
    if (this.smoke) { this.scene.remove(this.smoke.points); this.smoke.dispose(); this.smoke = null; }

    var bank = new NS.MaterialBank(this.cutPlane);
    var model = NS.buildModel(key, bank, { detail: this.kind === 'main' ? 'full' : 'hero', glowTex: this.glowTex });
    this.model = model;
    this.modelKey = key;
    this.scene.add(model.group);

    this.smoke = createSmoke(model.smoke, this.kind === 'hero' ? 90 : 150, this.smokeTex);
    this.smoke.points.visible = this.state.smoke;
    this.scene.add(this.smoke.points);

    this.levels.explode = this.state.explode ? 1 : 0;
    this.fit();
    this.userMoved = false;
    this.goPreset(this.kind === 'main' ? 'iso' : 'hero', true);
    this.apply(0, true);
    this.emit('model', { key: key, model: model });
    this.checkIntro();
    if (this.visible) this.start();
  };

  Viewer.prototype.fit = function () {
    var box = new THREE.Box3().setFromObject(this.model.group);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());
    var radius = size.length() / 2;
    var vfov = (this.camera.fov * Math.PI) / 180;
    var aspect = this.host.clientWidth / Math.max(1, this.host.clientHeight);
    var hfov = 2 * Math.atan(Math.tan(vfov / 2) * aspect);
    this.fitDist = (radius / Math.sin(Math.min(vfov, hfov) / 2)) * (this.kind === 'main' ? 0.98 : 0.92);
    this.bounds = { box: box, size: size, center: center, radius: radius };
    this.controls.minDistance = this.fitDist * 0.16;
    this.controls.maxDistance = this.fitDist * 1.8;
    this.cutStart = box.max.z + 0.05;
    var R = Math.max(size.x, size.z) * 0.62;
    this.stage.scale.setScalar(R);
    this.stage.position.set(center.x, box.min.y - 0.02, center.z);
  };

  /* ---------------- câmera ---------------- */
  Viewer.prototype.flushDamping = function () {
    var c = this.controls;
    var d = c.enableDamping;
    c.enableDamping = false;
    c.update();
    c.enableDamping = d;
  };

  Viewer.prototype.animateCamera = function (target, radius, phi, theta, snap, dur) {
    var c = this.controls;
    this.flushDamping();
    var from = new THREE.Spherical().setFromVector3(this._v.copy(this.camera.position).sub(c.target));
    var toR = clamp(radius, c.minDistance, c.maxDistance);
    var toPhi = clamp(phi, c.minPolarAngle, c.maxPolarAngle);
    var dTheta = ((((theta - from.theta) % (Math.PI * 2)) + Math.PI * 3) % (Math.PI * 2)) - Math.PI;   // caminho mais curto
    if (snap || reduceMotion.matches) {
      c.target.copy(target);
      this._sph.set(toR, toPhi, from.theta + dTheta);
      this.camera.position.setFromSpherical(this._sph).add(c.target);
      this.camera.lookAt(c.target);
      this.camAnim = null;
      c.update();
      return;
    }
    this.camAnim = {
      t: 0, dur: dur || 1.15,
      fromT: c.target.clone(), toT: target.clone(),
      from: { r: from.radius, phi: from.phi, theta: from.theta },
      to: { r: toR, phi: toPhi, theta: from.theta + dTheta }
    };
  };

  Viewer.prototype.currentSpherical = function () {
    var a = this.camAnim;
    if (a) return { radius: a.to.r, phi: a.to.phi, theta: a.to.theta, target: a.toT.clone() };
    var s = new THREE.Spherical().setFromVector3(this._v.copy(this.camera.position).sub(this.controls.target));
    return { radius: s.radius, phi: s.phi, theta: s.theta, target: this.controls.target.clone() };
  };

  Viewer.prototype.zoom = function (f) {
    if (!this.model) return;
    var s = this.currentSpherical();
    this.userMoved = true;
    this.animateCamera(s.target, s.radius * f, s.phi, s.theta, false, 0.5);
  };
  Viewer.prototype.rotateBy = function (a) {
    if (!this.model) return;
    var s = this.currentSpherical();
    this.userMoved = true;
    this.setAutoRotate(false);
    this.animateCamera(s.target, s.radius, s.phi, s.theta + a, false, 0.45);
  };
  Viewer.prototype.resetCamera = function () { this.goPreset(this.kind === 'main' ? 'iso' : 'hero'); };

  Viewer.prototype.anchorWorld = function (cid) {
    var c = this.model && this.model.components[cid];
    if (!c || !c.anchor) return null;
    return c.anchor.getWorldPosition(new THREE.Vector3());
  };

  Viewer.prototype.componentBox = function (cid) {
    var box = new THREE.Box3();
    var c = this.model && this.model.components[cid];
    if (c) c.roots.forEach(function (r) { box.expandByObject(r); });
    return box;
  };

  /** Enquadramento de cada preset (sem efeitos colaterais). */
  Viewer.prototype.presetCamera = function (name) {
    if (!this.bounds) return null;
    var b = this.bounds, d = this.fitDist, c = b.center.clone();
    switch (name) {
      case 'iso': return { t: c.clone().setY(c.y + b.size.y * 0.02), r: d * 0.95, phi: 1.08, theta: 0.72 };
      case 'front': return { t: c.clone(), r: d * 0.9, phi: 1.5, theta: 0 };
      case 'side': return { t: c.clone(), r: d * 0.9, phi: 1.52, theta: Math.PI / 2 };
      case 'uv':
        var box = this.componentBox('uv');
        if (box.isEmpty()) return null;
        return { t: box.getCenter(new THREE.Vector3()), r: Math.max(1.5, box.getSize(new THREE.Vector3()).length() * 1.2), phi: 1.74, theta: 0.42 };
      default: return { t: c.clone().setY(c.y + b.size.y * 0.03), r: d * 0.92, phi: 1.62, theta: 0.68 };
    }
  };

  /** Presets: Isométrica, Corte frontal, Perfil lateral e Foco na câmara interna UV. */
  Viewer.prototype.goPreset = function (name, snap) {
    var p = this.presetCamera(name);
    if (!p) return;
    if (name === 'front') { this.clearSelection(); this.setMode('cut'); }
    else if (name === 'uv') { this.setMode('xray'); this.setUv(true); this.select('uv', { camera: false }); }
    else if (name === 'iso') this.clearSelection();
    this.userMoved = false;
    this.animateCamera(p.t, p.r, p.phi, p.theta, snap);
    this.activePreset = name;
    this.emit('preset', name);
  };

  /* ---------------- estados ---------------- */
  Viewer.prototype.setMode = function (mode) {
    if (mode !== 'xray' && mode !== 'cut') mode = 'solid';
    if (this.state.mode === mode) return;
    this.state.mode = mode;
    this.el.classList.toggle('is-xray', mode === 'xray');
    this.el.classList.toggle('is-cut', mode === 'cut');
    this.emit('mode', mode);
  };
  Viewer.prototype.setExplode = function (on) {
    var was = this.state.explode;
    this.state.explode = !!on;
    if (was !== !!on && this.model) this.zoom(on ? 1.38 : 1 / 1.38);
    this.emit('toggle', { name: 'explode', value: !!on });
  };
  Viewer.prototype.setUv = function (on) { this.state.uv = !!on; this.emit('toggle', { name: 'uv', value: !!on }); };
  Viewer.prototype.setSmoke = function (on) {
    this.state.smoke = !!on;
    if (this.smoke) this.smoke.points.visible = this.state.smoke;
    this.emit('toggle', { name: 'smoke', value: !!on });
  };
  Viewer.prototype.setHotspots = function (on) { this.state.hotspots = !!on; this.emit('toggle', { name: 'hotspots', value: !!on }); };
  Viewer.prototype.setAutoRotate = function (on) {
    this.state.autoRotate = !!on;
    if (this.controls) this.controls.autoRotate = !!on;
    this.emit('toggle', { name: 'autorotate', value: !!on });
  };
  Viewer.prototype.setImmersive = function (on) {
    if (!this.controls) return;
    this.controls.enableZoom = !!on;
    this.renderer.domElement.style.touchAction = on ? 'none' : 'pan-y';
  };
  /** Reserva espaço para a gaveta (direita) ou para o painel inferior (celular). */
  Viewer.prototype.setInset = function (right, bottom) {
    this.inset.right = right || 0;
    this.inset.bottom = bottom || 0;
    this.updateProjection();
  };
  Viewer.prototype.updateProjection = function () {
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h || !this.camera) return;
    var cam = this.camera, r = this.inset.right, b = this.inset.bottom;
    if (r > 0) { cam.aspect = (w + r) / h; cam.setViewOffset(w + r, h, r, 0, w, h); }
    else if (b > 0) {
      // painel inferior (celular): o alvo fica no centro da faixa visível e a vista se afasta na mesma proporção
      var s = clamp((h - b) / h, 0.5, 1);
      cam.aspect = w / h;
      cam.setViewOffset(s * w, s * h, ((s - 1) * w) / 2, (s * h - h + b) / 2, w, h);
    }
    else { cam.clearViewOffset(); cam.aspect = w / h; }
    cam.updateProjectionMatrix();
  };

  /* ---------------- seleção e isolamento ---------------- */
  Viewer.prototype.select = function (cid, o) {
    o = o || {};
    if (!this.model || !this.model.components[cid]) return;
    this.state.selected = cid;
    this.updateHighlight();
    if (o.camera !== false) this.focusComponent(cid);
    this.emit('select', cid);
  };
  Viewer.prototype.clearSelection = function (silent) {
    if (!this.state.selected) return;
    this.state.selected = null;
    this.updateHighlight();
    if (!silent) this.emit('select', null);
  };
  Viewer.prototype.focusComponent = function (cid) {
    var box = this.componentBox(cid);
    if (box.isEmpty()) return;
    var ct = box.getCenter(new THREE.Vector3());
    var r = Math.max(0.2, box.getSize(new THREE.Vector3()).length() / 2);
    var s = this.currentSpherical();
    this.userMoved = true;
    this.animateCamera(ct, clamp(r * 3.1, this.fitDist * 0.24, this.fitDist * 1.05), clamp(s.phi, 0.95, 1.85), s.theta);
  };
  Viewer.prototype.updateHighlight = function () {
    if (this.highlight) {
      this.scene.remove(this.highlight);
      this.highlight.geometry.dispose();
      this.highlight.material.dispose();
      this.highlight = null;
    }
    if (!this.state.selected) return;
    this.hlBox = new THREE.Box3();
    this.highlight = new THREE.Box3Helper(this.hlBox, NS.COLORS.cyanBright);
    this.highlight.material.transparent = true;
    this.highlight.material.opacity = 0.85;
    this.highlight.material.depthTest = false;
    this.highlight.renderOrder = RO.highlight;
    this.scene.add(this.highlight);
    this.refreshHighlight();
  };
  Viewer.prototype.refreshHighlight = function () {
    if (!this.highlight) return;
    var box = this.hlBox;
    box.makeEmpty();
    var c = this.model.components[this.state.selected];
    if (c) c.roots.forEach(function (r) { box.expandByObject(r); });
    box.expandByScalar(0.02);
  };

  /* ---------------- clique e hover (raycast) ---------------- */
  Viewer.prototype.bindPicking = function () {
    var self = this;
    var canvas = this.renderer.domElement;
    this.raycaster = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    var down = null;
    canvas.addEventListener('pointerdown', function (e) { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
    canvas.addEventListener('pointerup', function (e) {
      var d = down;
      down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > 6 || performance.now() - d.t > 650) return;
      var cid = self.pick(e.clientX, e.clientY);
      if (cid) self.select(cid);
      else self.clearSelection();
    });
    var pending = false, lastE = null;
    canvas.addEventListener('pointermove', function (e) {
      if (e.buttons || e.pointerType === 'touch') return;
      lastE = e;
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        if (!lastE || !self.model) return;
        var cid = self.pick(lastE.clientX, lastE.clientY);
        if (cid !== self.hovered) {
          self.hovered = cid;
          self.el.classList.toggle('is-hovering', !!cid);
          self.emit('hover', cid);
        }
      });
    });
    canvas.addEventListener('pointerleave', function () {
      if (self.hovered) { self.hovered = null; self.el.classList.remove('is-hovering'); self.emit('hover', null); }
    });
  };

  Viewer.prototype.pick = function (x, y) {
    if (!this.model) return null;
    var rect = this.renderer.domElement.getBoundingClientRect();
    this.ndc.set(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    var hits = this.raycaster.intersectObjects(this.model.pickables, false);
    var xray = this.levels.xray > 0.5, cut = this.levels.cut > 0.5, cutZ = this.cutPlane.constant;
    for (var i = 0; i < hits.length; i++) {
      var o = hits[i].object;
      if (o.userData.shellMesh && (xray || (cut && hits[i].point.z > cutZ))) continue;   // atravessa a pele translúcida / cortada
      return o.userData.cid || null;
    }
    return null;
  };

  /* ---------------- anotações 3D (projeção para a tela) ---------------- */
  Viewer.prototype.setHotspotElements = function (list) { this.hotspotEls = list || []; };
  Viewer.prototype.updateHotspots = function () {
    var list = this.hotspotEls;
    if (!list.length || !this.model) return;
    var w = this.host.clientWidth, h = this.host.clientHeight;
    var L = this.levels;
    var reveal = Math.max(L.xray, L.cut, L.explode) > 0.5 || !!this.state.selected;
    var v = this._v;
    for (var i = 0; i < list.length; i++) {
      var it = list[i];
      var comp = this.model.components[it.cid];
      var show = this.state.hotspots && comp && comp.anchor && (!it.internal || reveal);
      if (show) {
        comp.anchor.getWorldPosition(v);
        v.project(this.camera);
        show = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05;
      }
      if (!show) {
        if (!it.off) { it.off = true; it.el.classList.add('is-off'); it.el.tabIndex = -1; }
        continue;
      }
      if (it.off) { it.off = false; it.el.classList.remove('is-off'); it.el.tabIndex = 0; }
      it.el.style.transform = 'translate3d(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px,0)';
    }
  };

  /* ---------------- introdução: monta a coifa a partir da vista explodida ---------------- */
  Viewer.prototype.checkIntro = function () {
    if (this.kind !== 'main' || this.introDone || !this.model || this.ratio < 0.35) return;
    this.introDone = true;
    if (reduceMotion.matches || this.state.explode) return;
    this.levels.explode = 1;
    this.apply(0, true);
    var s = this.currentSpherical();
    this.animateCamera(s.target, s.radius * 1.4, s.phi, s.theta, true);
    this.animateCamera(s.target, s.radius, s.phi, s.theta, false, 1.6);
  };

  /* ---------------- ciclo ---------------- */
  Viewer.prototype.start = function () {
    if (this.running || !this.renderer || !this.model || doc.hidden) return;
    this.running = true;
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.tick);
  };
  Viewer.prototype.stop = function () {
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
  };

  /** Aplica níveis animados: Raio-X, corte, isolamento, UV-C e explosão. */
  Viewer.prototype.apply = function (dt, snap) {
    var m = this.model;
    if (!m) return;
    var L = this.levels, S = this.state;
    var rate = 6;
    if (snap) {
      L.xray = S.mode === 'xray' ? 1 : 0;
      L.cut = S.mode === 'cut' ? 1 : 0;
      L.uv = S.uv ? 1 : 0;
    } else {
      L.xray = damp(L.xray, S.mode === 'xray' ? 1 : 0, rate, dt);
      L.cut = damp(L.cut, S.mode === 'cut' ? 1 : 0, 3.2, dt);
      L.uv = damp(L.uv, S.uv ? 1 : 0, rate, dt);
      L.explode = damp(L.explode, S.explode ? 1 : 0, 4.2, dt);
    }

    // materiais: Raio-X na carcaça + isolamento do componente em foco
    var sel = S.selected;
    var comp = sel && m.components[sel];
    var seeInside = !!(comp && comp.seeInside);
    var all = m.bank.all;
    for (var i = 0; i < all.length; i++) {
      var mat = all[i], u = mat.userData;
      if (u.additive) continue;
      var tg = 0;
      if (sel) tg = u.cid === sel ? (u.shell && seeInside ? 0.82 : 0) : (u.context ? 0.55 : 1);
      u.ghost = snap ? tg : damp(u.ghost || 0, tg, 7, dt);
      if (u.shell) {
        var x = Math.max(L.xray, u.ghost);
        mat.opacity = 1 - 0.93 * x;
        mat.depthWrite = x < 0.5;           // (2) carcaça translúcida não grava profundidade
      } else {
        mat.opacity = 1 - 0.86 * u.ghost;
        mat.depthWrite = u.ghost < 0.5;     // órgãos internos gravam profundidade
      }
    }
    if (this.smoke) {          // fumaça discreta quando há uma peça em foco (close-ups)
      var sm = this.smoke.points.material;
      sm.opacity = snap ? (sel ? 0.1 : 0.3) : damp(sm.opacity, sel ? 0.1 : 0.3, 5, dt);
    }
    m.bank.skin.uniforms.uOpacity.value = 0.62 * L.xray;
    m.bank.skin.visible = L.xray > 0.002;
    m.bank.edges.opacity = 0.85 * L.xray;
    m.bank.edges.visible = L.xray > 0.002;

    // corte frontal: o plano varre a carcaça da frente até a seção
    if (L.cut > 0.001) this.cutPlane.constant = lerp(this.cutStart, m.cutZ, easeInOutCubic(L.cut));
    else this.cutPlane.constant = 1e4;

    // UV-C
    var uv = L.uv, self = this;
    m.uv.quartz.forEach(function (q) { q.emissiveIntensity = uv * 2.6; q.color.copy(self.tubeOff).lerp(self.tubeOn, uv); });
    m.uv.halos.forEach(function (h) { h.opacity = uv * 0.5; });
    m.uv.lights.forEach(function (l) { l.intensity = uv * 3.0; });
    m.uv.leds.forEach(function (led) { led.emissiveIntensity = uv * 2.5; });
    if (m.uv.glow) m.uv.glow.material.opacity = uv * 0.75;

    // vista explodida
    var e = L.explode * L.explode * (3 - 2 * L.explode);
    m.parts.forEach(function (p) { p.position.copy(p.userData.home).addScaledVector(p.userData.explode, e); });
  };

  /** Qualidade adaptativa: reduz resolução e depois efeitos se o aparelho não sustenta ~22 fps. */
  Viewer.prototype.adapt = function (raw) {
    if (raw > 0.5) return;
    this.ema = this.ema ? this.ema * 0.94 + raw * 0.06 : raw;
    this.sampled = (this.sampled || 0) + 1;
    if (this.sampled < 90 || this.ema < 0.045) return;
    this.sampled = 0;
    var pr = this.renderer.getPixelRatio();
    if (pr > 1) {
      this.renderer.setPixelRatio(Math.max(1, pr - 0.5));
      this.renderer.setSize(this.host.clientWidth, this.host.clientHeight, false);
    } else if (!this.lowPower) {
      this.lowPower = true;
      this.setAutoRotate(false);
      this.setSmoke(false);
    }
  };

  Viewer.prototype.tick = function (now) {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.tick);
    var raw = (now - this.last) / 1000 || 0.016;
    var dt = Math.min(0.05, raw);
    this.last = now;
    this.adapt(raw);

    this.apply(dt, false);

    var a = this.camAnim;
    if (a) {
      a.t += dt / a.dur;
      var k = easeInOutCubic(Math.min(1, a.t));
      this.controls.target.lerpVectors(a.fromT, a.toT, k);
      this._sph.set(lerp(a.from.r, a.to.r, k), lerp(a.from.phi, a.to.phi, k), lerp(a.from.theta, a.to.theta, k));
      this.camera.position.setFromSpherical(this._sph).add(this.controls.target);
      this.camera.lookAt(this.controls.target);
      if (a.t >= 1) this.camAnim = null;
    }
    this.controls.update();
    if (this.bounds) this.controls.target.clamp(this.bounds.box.min, this.bounds.box.max);   // o pan não "perde" o modelo

    if (this.smoke && this.state.smoke) this.smoke.update(dt, this.levels.uv > 0.5);
    var spin = reduceMotion.matches ? 1.2 : 6.5;
    this.model.spinners.forEach(function (s) { s.rotation.z -= dt * spin; });
    if (this.highlight) this.refreshHighlight();

    this.renderer.render(this.scene, this.camera);
    this.updateHotspots();

    if (now - this.telemetryAt > 120) {
      this.telemetryAt = now;
      var s = this._sph.setFromVector3(this._v.copy(this.camera.position).sub(this.controls.target));
      this.emit('telemetry', { az: ((s.theta * 180) / Math.PI + 360) % 360, el: 90 - (s.phi * 180) / Math.PI, dist: s.radius });
    }

    if (!this.ready) {
      this.ready = true;
      this.el.classList.remove('is-loading');
      this.el.classList.add('is-ready');
      this.emit('ready');
    }
  };

  Viewer.prototype.resize = function () {
    if (!this.renderer) return;
    var w = this.host.clientWidth, h = this.host.clientHeight;
    if (!w || !h) return;
    this.renderer.setSize(w, h, false);
    this.updateProjection();
    if (this.model && !this.userMoved && !this.camAnim) {
      this.fit();
      var p = this.presetCamera(this.activePreset || (this.kind === 'main' ? 'iso' : 'hero'));
      if (p) this.animateCamera(p.t, p.r, p.phi, p.theta, true);
    }
    this.el.style.setProperty('--scan-h', h + 'px');
  };

  NS.Viewer = Viewer;
})();
