/* Smartech 3.0 — 3d/models.js
 * Montagem dos modelos com anatomia interna completa.
 *
 * Coordenadas da coifa de parede (metros): X = comprimento, Y = altura (0 = borda inferior),
 * Z = profundidade (parede em z = −0,60; frente em z = +0,60). z' = distância até a parede.
 *
 *   Carcaça ............ fundo, tampo, frente inclinada, testeira, laterais trapezoidais (shell)
 *   Colarinho .......... Ø 540 mm, com damper borboleta (lâmina a ≈ 34°) e alavanca externa
 *   Pleno cônico ....... transição squircle 1,44 × 0,34 m → círculo do colarinho
 *   Filtros baffle ..... banco inclinado de (y 0,10; z' 0,14) a (y 0,66; z' 0,58) ≈ 52°
 *   Bateria UV-C ....... 2 fileiras × 2 lâmpadas de 1,2 m no plenum, após os filtros
 *   Refletores ......... parabólicos (f = 25 mm) com abertura voltada para os filtros
 *   Canaleta ........... perímetro inferior, caimento 1,5% até o dreno de 1/2"
 *   Elétrica ........... comando IP65 + 2 reatores sobre o tampo; conduítes até os soquetes
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var NS = window.Smartech3D;
  var P = NS.parts;
  var RO = NS.RENDER_ORDER;

  var INTERNAL = { pleno: true, uv: true, refletor: true, baffle: true, canaleta: true };
  var SEE_INSIDE = { damper: true, exaustor: true, carcaca: false };

  function Model(bank) {
    this.bank = bank;
    this.group = new THREE.Group();
    this.components = {};
    this.parts = [];
    this.shellMeshes = [];
    this.pickables = [];
    this.uv = { lights: [], halos: [], quartz: [], glow: null, leds: [] };
    this.spinners = [];
    this.smoke = null;
    this.cutZ = 0;
    this.hotspots = [];
  }

  Model.prototype.comp = function (cid) {
    var c = this.components[cid];
    if (!c) c = this.components[cid] = { cid: cid, roots: [], anchor: null, internal: !!INTERNAL[cid], seeInside: !!SEE_INSIDE[cid] };
    return c;
  };

  /** Registra um objeto como parte do componente (clique, isolamento, destaque). */
  Model.prototype.register = function (cid, obj) {
    var c = this.comp(cid);
    c.roots.push(obj);
    var picks = this.pickables;
    obj.traverse(function (o) {
      if ((o.isMesh || o.isInstancedMesh) && !o.userData.noPick) { o.userData.cid = cid; picks.push(o); }
    });
    return obj;
  };

  /** Converte a malha em carcaça: renderOrder 10 + pele fresnel e arestas do Raio-X como filhas. */
  Model.prototype.shell = function (mesh) {
    mesh.renderOrder = RO.shell;
    mesh.userData.shellMesh = true;
    var skin = new THREE.Mesh(mesh.geometry, this.bank.skin);
    skin.renderOrder = RO.skin;
    skin.userData.noPick = true;
    skin.userData.fx = true;
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 28), this.bank.edges);
    edges.renderOrder = RO.edges;
    edges.userData.noPick = true;
    edges.userData.fx = true;
    mesh.add(skin);
    mesh.add(edges);
    this.shellMeshes.push(mesh);
    return mesh;
  };

  /** Deslocamento na vista explodida. */
  Model.prototype.part = function (obj, x, y, z) {
    obj.userData.explode = new THREE.Vector3(x, y, z);
    this.parts.push(obj);
    return obj;
  };

  /** Ponto da anotação 3D (acompanha a peça na explosão). */
  Model.prototype.anchor = function (cid, parent, x, y, z) {
    var a = new THREE.Object3D();
    a.position.set(x, y, z);
    parent.add(a);
    this.comp(cid).anchor = a;
    return a;
  };

  Model.prototype.finalize = function (hotspots) {
    this.group.traverse(function (o) {
      if ((o.isMesh || o.isInstancedMesh) && !o.renderOrder) o.renderOrder = RO.internal;   // órgãos internos primeiro
    });
    this.parts.forEach(function (p) { p.userData.home = p.position.clone(); });
    var self = this;
    this.hotspots = (hotspots || []).filter(function (cid) { return self.components[cid] && self.components[cid].anchor; });
    this.group.updateMatrixWorld(true);
  };

  Model.prototype.dispose = function () {
    var seen = new Set();
    this.group.traverse(function (o) {
      if (o.geometry && !seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
    });
    this.bank.dispose();
  };

  /* ====================================================================== */
  /* Coifa de parede                                                         */
  /* ====================================================================== */
  function buildWallHood(model, parent, o) {
    var B = model.bank;
    var full = o.detail !== 'hero';
    var W = 3.0, D = 1.2, H = 0.75, T = 0.035;
    var zb = -D / 2;
    var collarZ = zb + 0.3, collarR = 0.27, collarH = 0.32;
    var root = new THREE.Group();
    parent.add(root);

    /* ---- carcaça (shell) ---- */
    var mShell = B.get('carcaca', 'shell', { shell: true });
    var mSide = B.get('carcaca', 'shellSide', { shell: true });
    var mTrim = B.get('carcaca', 'gold', { shell: true });
    function sh(mesh, cid, ex, ey, ez) {
      root.add(mesh);
      model.shell(mesh);
      model.register(cid, mesh);
      if (ex !== undefined) model.part(mesh, ex, ey, ez);
      return mesh;
    }
    sh(P.box(W, H, T, mShell, 0, H / 2, zb + T / 2), 'carcaca', 0, 0.05, -0.75);                    // fundo
    sh(P.box(W, T, 0.56, mShell, 0, H - T / 2, zb + 0.28), 'carcaca', 0, 0.85, 0);                  // tampo
    var slope = P.box(W, T, Math.hypot(D - 0.56, H - 0.24), mShell, 0, (H + 0.24) / 2, zb + (0.56 + D) / 2);
    slope.rotation.x = Math.atan2(H - 0.24, D - 0.56);                                               // frente inclinada
    sh(slope, 'carcaca', 0, 0.45, 0.6);
    sh(P.box(W, 0.24, T, mShell, 0, 0.12, D / 2 - T / 2), 'carcaca', 0, -0.15, 0.85);              // testeira
    sh(P.box(W + 0.02, 0.035, 0.08, mTrim, 0, 0.0175, D / 2 - 0.04), 'carcaca', 0, -0.3, 0.85);    // friso dourado

    var shape = new THREE.Shape();
    shape.moveTo(0, 0); shape.lineTo(D, 0); shape.lineTo(D, 0.24); shape.lineTo(0.56, H); shape.lineTo(0, H); shape.lineTo(0, 0);
    var sideGeo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
    sideGeo.rotateY(-Math.PI / 2);          // (x, y, z) → (−z, y, x): o perfil (z', y) vira a lateral
    sideGeo.translate(0, 0, zb);
    sh(P.mesh(sideGeo, mSide, -W / 2 + T, 0, 0), 'carcaca', -0.85, 0, 0);
    sh(P.mesh(sideGeo.clone(), mSide, W / 2, 0, 0), 'carcaca', 0.85, 0, 0);
    model.anchor('carcaca', slope, 0.95, T / 2 + 0.005, 0.05);

    /* ---- colarinho (shell do componente damper) ---- */
    var collar = new THREE.Group();
    collar.position.set(0, H, collarZ);
    root.add(collar);
    var mC = B.get('damper', 'shell', { shell: true });
    var mCG = B.get('damper', 'gold', { shell: true });
    [
      P.cyl(collarR, collarR, collarH, 48, mC, 0, collarH / 2, 0, true),
      P.cyl(0.33, 0.33, 0.025, 48, mC, 0, 0.0125, 0),
      P.cyl(collarR + 0.006, collarR + 0.006, 0.026, 48, mCG, 0, collarH - 0.06, 0, true)
    ].forEach(function (m) { collar.add(m); model.shell(m); model.register('damper', m); });
    model.part(collar, 0, 1.25, 0);

    if (full) {
      var dmp = P.butterflyDamper(0.25, B.get('damper', 'inox'), B.get('damper', 'inoxDark'), B.get('damper', 'inoxDark'), B.get('damper', 'gold'), 0.6);
      dmp.position.set(0, H + 0.16, collarZ);
      root.add(dmp);
      model.register('damper', dmp);
      model.part(dmp, 0, 1.25, 0);
      model.anchor('damper', dmp.userData.lever, 0.03, 0.06, 0);

      /* ---- pleno cônico ---- */
      var coneGeo = P.loftGeometry({ y0: H - 0.16, y1: H - T, a: 0.72, b: 0.17, r: collarR - 0.006, p: 4 });
      coneGeo.translate(0, 0, collarZ);
      var cone = P.mesh(coneGeo, B.get('pleno', 'inox', { double: true }));
      root.add(cone);
      model.register('pleno', cone);
      model.part(cone, 0, 0.55, 0);
      model.anchor('pleno', cone, 0.62, H - 0.13, collarZ + 0.05);
    } else {
      model.anchor('damper', collar, collarR, collarH * 0.6, 0);
    }

    /* ---- filtros baffle (banco inclinado) ---- */
    var P1y = 0.1, P1z = zb + 0.14, P2y = 0.66, P2z = zb + 0.58;
    var flen = Math.hypot(P2y - P1y, P2z - P1z);
    var fbank = new THREE.Group();
    fbank.position.set(0, P1y, P1z);
    fbank.rotation.x = Math.atan2(P2z - P1z, P2y - P1y);       // eixo local Y sobe pela inclinação
    var bankInner = P.baffleBank({ width: W - 2 * T - 0.05, height: flen - 0.02, count: 5, gap: 0.012, vanes: 9 }, B.get('baffle', 'inoxDark'), B.get('baffle', 'vane'));
    bankInner.position.y = flen / 2;
    fbank.add(bankInner);
    root.add(fbank);
    model.register('baffle', fbank);
    model.part(fbank, 0, -0.55, 0.45);
    model.anchor('baffle', fbank, 0.9, flen * 0.55, 0.05);

    if (full) {
      /* ---- canaleta perimetral (caimento 1,5%) e dreno ---- */
      var mG = B.get('canaleta', 'inox');
      var sl = Math.atan(0.015);
      var gut = new THREE.Group();
      root.add(gut);
      gut.add(P.channelX(W - 0.12, mG, 0, 0.026, D / 2 - 0.065, sl));
      gut.add(P.channelX(W - 0.12, mG, 0, 0.065, zb + 0.115, sl));
      gut.add(P.channelZ(D - 0.2, mG, -W / 2 + 0.07, 0.026, 0, sl));
      gut.add(P.channelZ(D - 0.2, mG, W / 2 - 0.07, 0.026, 0, sl));
      model.register('canaleta', gut);
      model.part(gut, 0, -0.75, 0);
      model.anchor('canaleta', gut, 0.95, 0.07, D / 2 - 0.065);

      var valve = P.ballValve(B.get('dreno', 'inox'), B.get('dreno', 'brass'), B.get('dreno', 'gold'));
      valve.position.set(W / 2 - 0.14, 0.045, zb + 0.115);
      root.add(valve);
      model.register('dreno', valve);
      model.part(valve, 0, -0.75, 0);
      model.anchor('dreno', valve, 0.03, -0.075, 0.04);

      /* ---- bateria UV-C: 2 fileiras no plenum, refletores voltados para os filtros ---- */
      var oz = 0.786, oy = -0.618, on = Math.hypot(oz, oy);
      oz /= on; oy /= on;
      var rows = [{ y: 0.33, z: zb + 0.17 }, { y: 0.53, z: zb + 0.27 }];
      var uvG = new THREE.Group(), refG = new THREE.Group();
      root.add(uvG);
      root.add(refG);
      var mQ = B.get('uv', 'quartz'), mBand = B.get('uv', 'inoxDark'), mHalo = B.additive('uv', NS.COLORS.uv);
      var mMirror = B.get('refletor', 'mirror'), mCer = B.get('refletor', 'ceramic'), mPin = B.get('refletor', 'inoxDark');
      model.uv.quartz.push(mQ);
      model.uv.halos.push(mHalo);
      rows.forEach(function (row) {
        refG.add(P.mesh(P.reflectorGeometry(2.62, row.z, row.y, oz, oy, 0.025, 0.075, 0.003), mMirror));
        [-0.64, 0.64].forEach(function (x) {
          var lamp = P.lamp(1.2, mQ, mBand, mHalo);
          lamp.position.set(x, row.y, row.z);
          uvG.add(lamp);
          [-1, 1].forEach(function (s) {
            var sk = P.socketG13(mCer, mPin, -s);
            sk.position.set(x + s * 0.615, row.y, row.z);
            refG.add(sk);
          });
        });
        var L = new THREE.PointLight(NS.COLORS.uv, 0, 2.4, 2);
        L.position.set(0, row.y + oy * 0.08, row.z + oz * 0.08);
        uvG.add(L);
        model.uv.lights.push(L);
      });
      model.register('uv', uvG);
      model.register('refletor', refG);
      model.part(uvG, 0, 0.22, -0.32);
      model.part(refG, 0, 0.22, -0.32);
      model.anchor('uv', uvG, 0.64, rows[1].y, rows[1].z);
      model.anchor('refletor', refG, -1.255, rows[0].y, rows[0].z);

      /* ---- comando IP65, reatores e conduítes ---- */
      var cb = P.controlBox(B.get('comando', 'graphite'), B.get('comando', 'dark'), B.get('comando', 'gold'), B.get('comando', 'dark'), B.get('comando', 'led'));
      cb.position.set(-1.12, H, zb + 0.2);
      root.add(cb);
      model.register('comando', cb);
      model.part(cb, -0.15, 1.05, -0.1);
      model.anchor('comando', cb, 0, 0.27, 0.06);
      model.uv.leds.push(cb.userData.led.material);

      var mBal = B.get('reatores', 'graphite'), mFin = B.get('reatores', 'inoxDark'), mCond = B.get('reatores', 'conduit');
      var bl = new THREE.Group();
      root.add(bl);
      [zb + 0.16, zb + 0.3].forEach(function (z) {
        var b = P.ballast(mBal, mFin);
        b.position.set(-0.68, H, z);
        bl.add(b);
      });
      bl.add(P.conduit([[-0.912, H + 0.06, zb + 0.2], [-0.895, H + 0.075, zb + 0.18], [-0.88, H + 0.03, zb + 0.16]], 0.009, mCond));
      bl.add(P.conduit([[-0.912, H + 0.16, zb + 0.2], [-0.9, H + 0.12, zb + 0.25], [-0.88, H + 0.03, zb + 0.3]], 0.009, mCond));
      bl.add(P.conduit([[-0.48, H + 0.03, zb + 0.16], [-0.42, H + 0.07, zb + 0.13], [-0.38, H + 0.012, zb + 0.08]], 0.009, mCond));
      bl.add(P.conduit([[-0.48, H + 0.03, zb + 0.3], [-0.42, H + 0.09, zb + 0.22], [-0.38, H + 0.012, zb + 0.08]], 0.009, mCond));
      bl.add(P.cyl(0.016, 0.016, 0.02, 12, mFin, -0.38, H + 0.01, zb + 0.08));
      model.register('reatores', bl);
      model.part(bl, -0.1, 1.05, -0.1);
      model.anchor('reatores', bl, -0.68, H + 0.1, zb + 0.23);

      var ic = new THREE.Group();
      root.add(ic);
      var en = [-0.38, H - 0.05, zb + 0.06];
      ic.add(P.conduit([en, [-0.4, 0.52, zb + 0.05], [-0.95, 0.42, zb + 0.055], [-1.26, 0.37, zb + 0.1], [-1.262, 0.355, zb + 0.15]], 0.008, mCond));
      ic.add(P.conduit([en, [-0.6, 0.64, zb + 0.05], [-1.15, 0.6, zb + 0.08], [-1.262, 0.56, zb + 0.22]], 0.008, mCond));
      ic.add(P.conduit([en, [0, 0.672, zb + 0.048], [0.95, 0.66, zb + 0.05], [1.262, 0.55, zb + 0.17], [1.262, 0.36, zb + 0.15]], 0.008, mCond));
      model.register('reatores', ic);
      model.part(ic, 0, 0.22, -0.32);
    }

    /* ---- luz UV: clarão sob a coifa + luzes pontuais (também no hero, sem a bateria modelada) ---- */
    var glow = P.mesh(new THREE.PlaneGeometry(W - 0.4, D - 0.15), B.additive('uv', 0xb794f6, o.glowTex), 0, -0.015, 0.02);
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = RO.glow;
    glow.userData.noPick = true;
    root.add(glow);
    model.uv.glow = glow;
    if (!full) {
      [0.33, 0.53].forEach(function (y) {
        var L = new THREE.PointLight(NS.COLORS.uv, 0, 2.4, 2);
        L.position.set(0, y, zb + 0.3);
        root.add(L);
        model.uv.lights.push(L);
      });
    }

    var cook = P.cooktop(W - 0.3, 0.95, B.get('contexto', 'dark', { context: true }), B.get('contexto', 'gold', { context: true }), B.get('contexto', 'inoxDark', { context: true }), 4);
    cook.position.y = -1.3;
    root.add(cook);

    return { root: root, collarZ: collarZ, H: H, W: W, D: D };
  }

  function wallHoodModel(bank, o) {
    var m = new Model(bank);
    var h = buildWallHood(m, m.group, o);
    m.smoke = { cx: 0, cz: 0.05, hw: h.W / 2 - 0.45, hd: 0.3, y0: -1.15, yFilter: 0.1, yTop: h.H + 0.45, collarX: 0, collarZ: h.collarZ };
    m.cutZ = -0.04;
    return m;
  }

  /* ====================================================================== */
  /* Sistema completo: coifa + duto + caixa exaustora                        */
  /* ====================================================================== */
  function systemModel(bank, o) {
    var m = new Model(bank);
    var B = bank;
    var s = 0.6;
    var holder = new THREE.Group();
    holder.scale.setScalar(s);
    holder.position.set(-2.0, -0.2, 0.18);       // colarinho em x = −2, z = 0
    m.group.add(holder);
    buildWallHood(m, holder, { detail: 'full', glowTex: o.glowTex });

    var topY = -0.2 + (0.75 + 0.32) * s;
    var r = 0.27 * s;
    var hy = 1.65;

    var mD = B.get('duto', 'shell', { shell: true }), mDG = B.get('duto', 'gold', { shell: true });
    var duct = new THREE.Group();
    m.group.add(duct);
    var vLen = hy - topY;
    var hLen = 2.83;
    var pieces = [
      P.cyl(r, r, vLen, 40, mD, -2.0, topY + vLen / 2, 0, true),
      P.mesh(new THREE.SphereGeometry(r * 1.01, 32, 20), mD, -2.0, hy, 0)
    ];
    var hDuct = P.cyl(r, r, hLen, 40, mD, -2.0 + hLen / 2, hy, 0, true);
    hDuct.rotation.z = Math.PI / 2;
    pieces.push(hDuct);
    [[-2.0, topY + 0.03, false], [-2.0, topY + 0.62, false], [-0.4, hy, true], [0.62, hy, true]].forEach(function (p) {
      var ring = P.cyl(r + 0.03, r + 0.03, 0.04, 40, mDG, p[0], p[1], 0, true);
      if (p[2]) ring.rotation.z = Math.PI / 2;
      pieces.push(ring);
    });
    pieces.forEach(function (p) { duct.add(p); m.shell(p); m.register('duto', p); });
    m.part(duct, 0, 0.6, 0);
    m.anchor('duto', duct, -0.9, hy + r + 0.02, 0);

    var fan = new THREE.Group();
    fan.position.set(1.45, hy, 0);
    m.group.add(fan);
    var mF = B.get('exaustor', 'fan', { shell: true }), mFG = B.get('exaustor', 'gold', { shell: true });
    var housing = P.cyl(0.62, 0.62, 0.55, 56, mF);
    housing.rotation.x = Math.PI / 2;
    var shellPieces = [
      housing,
      P.box(0.5, 0.62, 0.5, mF, 0.3, 0.62, 0),
      P.box(0.56, 0.04, 0.56, mFG, 0.3, 0.94, 0),
      P.mesh(new THREE.TorusGeometry(0.62, 0.03, 12, 64), mFG, 0, 0, 0.275),
      P.mesh(new THREE.TorusGeometry(0.62, 0.03, 12, 64), mFG, 0, 0, -0.275)
    ];
    shellPieces.forEach(function (p) { fan.add(p); m.shell(p); m.register('exaustor', p); });
    var base = P.box(1.05, 0.08, 0.95, B.get('exaustor', 'dark'), 0, -0.68, -0.1);
    fan.add(base);
    m.register('exaustor', base);
    var imp = P.impeller(0.5, 0.42, B.get('exaustor', 'inoxDark'), B.get('exaustor', 'inox'));
    fan.add(imp);
    m.register('exaustor', imp);
    m.spinners.push(imp);
    m.part(fan, 1.0, 0.25, 0);
    m.anchor('exaustor', fan, 0, 0.66, 0.28);

    var motor = new THREE.Group();
    motor.position.set(1.45, hy, -0.66);
    m.group.add(motor);
    var mM = B.get('motor', 'fan'), mMF = B.get('motor', 'inoxDark');
    var body = P.cyl(0.27, 0.27, 0.55, 40, mM);
    body.rotation.x = Math.PI / 2;
    motor.add(body);
    for (var i = 0; i < 5; i++) {
      var fin = P.cyl(0.295, 0.295, 0.018, 40, mMF, 0, 0, -0.2 + i * 0.1);
      fin.rotation.x = Math.PI / 2;
      motor.add(fin);
    }
    var shaft = P.cyl(0.03, 0.03, 0.2, 16, mMF, 0, 0, 0.37);
    shaft.rotation.x = Math.PI / 2;
    motor.add(shaft);
    m.register('motor', motor);
    m.part(motor, 0, 0, -0.9);
    m.anchor('motor', motor, 0, 0.3, -0.1);

    m.smoke = { cx: -2.0, cz: 0.2, hw: (1.5 - 0.45) * s, hd: 0.18, y0: -0.95, yFilter: -0.14, yTop: topY + 0.3, collarX: -2.0, collarZ: 0 };
    m.cutZ = 0.0;
    return m;
  }

  /* ====================================================================== */
  /* Coifa central de ilha                                                   */
  /* ====================================================================== */
  function islandModel(bank, o) {
    var m = new Model(bank);
    var B = bank;
    var root = m.group;
    var H = 0.75;
    var mS = B.get('carcaca', 'shell', { shell: true }), mT = B.get('carcaca', 'gold', { shell: true });

    var frustum = new THREE.CylinderGeometry(0.423, 1, H, 4, 1, true).toNonIndexed();
    frustum.rotateY(Math.PI / 4);
    frustum.computeVertexNormals();
    var canopy = P.mesh(frustum, mS, 0, H / 2, 0);
    canopy.scale.set(1.839, 1, 1.202);                  // base 2,6 × 1,7 m → topo 1,1 × 0,72 m
    root.add(canopy); m.shell(canopy); m.register('carcaca', canopy); m.part(canopy, 0, 0.35, 0);
    m.anchor('carcaca', canopy, 0.35, 0.1, 0.42);

    var cap = P.box(1.1, 0.03, 0.72, mS, 0, H, 0);
    root.add(cap); m.shell(cap); m.register('carcaca', cap); m.part(cap, 0, 0.8, 0);

    var trim = new THREE.Group();
    root.add(trim);
    [[2.64, 0.035, 0.045, 0, 0.0175, 0.85], [2.64, 0.035, 0.045, 0, 0.0175, -0.85], [0.045, 0.035, 1.7, 1.3, 0.0175, 0], [0.045, 0.035, 1.7, -1.3, 0.0175, 0]].forEach(function (b) {
      var t = P.box(b[0], b[1], b[2], mT, b[3], b[4], b[5]);
      trim.add(t); m.shell(t); m.register('carcaca', t);
    });
    m.part(trim, 0, -0.28, 0);

    var mC = B.get('damper', 'shell', { shell: true }), mCG = B.get('damper', 'gold', { shell: true });
    var chim = new THREE.Group();
    root.add(chim);
    [P.box(0.62, 1.1, 0.62, mC, 0, H + 0.55, 0), P.box(0.66, 0.035, 0.66, mCG, 0, H + 0.4, 0)].forEach(function (p) {
      chim.add(p); m.shell(p); m.register('damper', p);
    });
    m.part(chim, 0, 1.1, 0);

    var dm = new THREE.Group();
    dm.position.set(0, H + 0.62, 0);
    root.add(dm);
    var blade = P.box(0.56, 0.006, 0.56, B.get('damper', 'inox'));
    blade.rotation.x = 0.6;
    dm.add(blade);
    var sh = P.cyl(0.008, 0.008, 0.72, 12, B.get('damper', 'inoxDark'));
    sh.rotation.z = Math.PI / 2;
    dm.add(sh);
    var lever = new THREE.Group();
    lever.position.x = 0.36;
    lever.add(P.box(0.006, 0.075, 0.095, B.get('damper', 'inoxDark')));
    var arm = P.box(0.012, 0.012, 0.115, B.get('damper', 'gold'), 0.012, 0, 0.03);
    arm.rotation.x = 0.6;
    lever.add(arm);
    dm.add(lever);
    m.register('damper', dm); m.part(dm, 0, 1.1, 0); m.anchor('damper', lever, 0.03, 0.06, 0);

    // filtros em V (dois bancos inclinados) + cumeeira
    var fb = new THREE.Group();
    root.add(fb);
    [1, -1].forEach(function (s) {
      var g = new THREE.Group();
      var y0 = 0.08, z0 = s * 0.74, y1 = 0.52, z1 = s * 0.14;
      var len = Math.hypot(y1 - y0, z1 - z0);
      g.position.set(0, y0, z0);
      g.rotation.x = Math.atan2(z1 - z0, y1 - y0);
      var inner = P.baffleBank({ width: 1.5, height: len - 0.02, count: 3, gap: 0.012, vanes: 9 }, B.get('baffle', 'inoxDark'), B.get('baffle', 'vane'));
      inner.position.y = len / 2;
      g.add(inner);
      fb.add(g);
    });
    fb.add(P.box(1.5, 0.02, 0.32, B.get('baffle', 'inoxDark'), 0, 0.535, 0));
    m.register('baffle', fb); m.part(fb, 0, -0.9, 0); m.anchor('baffle', fb, 0.45, 0.3, 0.5);

    // bateria UV-C: uma fileira sobre cada banco
    var uvG = new THREE.Group(), refG = new THREE.Group();
    root.add(uvG); root.add(refG);
    var mQ = B.get('uv', 'quartz'), mBand = B.get('uv', 'inoxDark'), mHalo = B.additive('uv', NS.COLORS.uv);
    var mMirror = B.get('refletor', 'mirror'), mCer = B.get('refletor', 'ceramic'), mPin = B.get('refletor', 'inoxDark');
    m.uv.quartz.push(mQ); m.uv.halos.push(mHalo);
    [1, -1].forEach(function (s) {
      var z = s * 0.3, y = 0.6, oz = -0.591 * s, oy = -0.806;
      refG.add(P.mesh(P.reflectorGeometry(1.26, z, y, oz, oy, 0.025, 0.07, 0.003), mMirror));
      var lamp = P.lamp(1.2, mQ, mBand, mHalo);
      lamp.position.set(0, y, z);
      uvG.add(lamp);
      [-1, 1].forEach(function (k) {
        var sk = P.socketG13(mCer, mPin, -k);
        sk.position.set(k * 0.615, y, z);
        refG.add(sk);
      });
      var L = new THREE.PointLight(NS.COLORS.uv, 0, 2.2, 2);
      L.position.set(0, y + oy * 0.08, z + oz * 0.08);
      uvG.add(L);
      m.uv.lights.push(L);
    });
    m.register('uv', uvG); m.register('refletor', refG);
    m.part(uvG, 0, 0.3, 0); m.part(refG, 0, 0.3, 0);
    m.anchor('uv', uvG, 0.3, 0.6, 0.3);
    m.anchor('refletor', refG, -0.615, 0.6, -0.3);

    // canaleta perimetral + dreno
    var mG = B.get('canaleta', 'inox');
    var slp = Math.atan(0.015);
    var gut = new THREE.Group();
    root.add(gut);
    gut.add(P.channelX(2.3, mG, 0, 0.026, 0.78, slp));
    gut.add(P.channelX(2.3, mG, 0, 0.026, -0.78, slp));
    gut.add(P.channelZ(1.5, mG, 1.2, 0.026, 0, slp));
    gut.add(P.channelZ(1.5, mG, -1.2, 0.026, 0, slp));
    m.register('canaleta', gut); m.part(gut, 0, -0.75, 0); m.anchor('canaleta', gut, -0.6, 0.06, 0.78);
    var valve = P.ballValve(B.get('dreno', 'inox'), B.get('dreno', 'brass'), B.get('dreno', 'gold'));
    valve.position.set(1.1, 0.02, 0.78);
    root.add(valve);
    m.register('dreno', valve); m.part(valve, 0, -0.75, 0); m.anchor('dreno', valve, 0.03, -0.075, 0.04);

    // comando na chaminé, reatores sobre o tampo
    var cb = P.controlBox(B.get('comando', 'graphite'), B.get('comando', 'dark'), B.get('comando', 'gold'), B.get('comando', 'dark'), B.get('comando', 'led'));
    cb.position.set(0.39, H + 0.1, 0);
    cb.rotation.y = Math.PI / 2;
    root.add(cb);
    m.register('comando', cb); m.part(cb, 0.5, 1.0, 0); m.anchor('comando', cb, 0, 0.27, 0.06);
    m.uv.leds.push(cb.userData.led.material);

    var mBal = B.get('reatores', 'graphite'), mFin = B.get('reatores', 'inoxDark'), mCond = B.get('reatores', 'conduit');
    var bl = new THREE.Group();
    root.add(bl);
    [-0.38, -0.48].forEach(function (x) {
      var b = P.ballast(mBal, mFin);
      b.rotation.y = Math.PI / 2;
      b.position.set(x, H + 0.015, 0);
      bl.add(b);
    });
    bl.add(P.conduit([[-0.43, H + 0.03, 0.2], [-0.46, H - 0.05, 0.27], [-0.6, 0.63, 0.3], [-0.628, 0.6, 0.3]], 0.008, mCond));
    bl.add(P.conduit([[-0.43, H + 0.03, -0.2], [-0.46, H - 0.05, -0.27], [-0.6, 0.63, -0.3], [-0.628, 0.6, -0.3]], 0.008, mCond));
    m.register('reatores', bl); m.part(bl, -0.5, 1.0, 0); m.anchor('reatores', bl, -0.43, H + 0.08, 0.1);

    var glow = P.mesh(new THREE.PlaneGeometry(2.3, 1.45), B.additive('uv', 0xb794f6, o.glowTex), 0, -0.015, 0);
    glow.rotation.x = -Math.PI / 2;
    glow.renderOrder = RO.glow;
    glow.userData.noPick = true;
    root.add(glow);
    m.uv.glow = glow;

    var cook = P.cooktop(2.3, 1.1, B.get('contexto', 'dark', { context: true }), B.get('contexto', 'gold', { context: true }), B.get('contexto', 'inoxDark', { context: true }), 3);
    cook.position.y = -1.3;
    root.add(cook);

    m.smoke = { cx: 0, cz: 0, hw: 0.9, hd: 0.4, y0: -1.15, yFilter: 0.1, yTop: H + 1.2, collarX: 0, collarZ: 0 };
    m.cutZ = 0.0;
    return m;
  }

  var BUILDERS = { 1: wallHoodModel, 2: systemModel, 3: islandModel };

  /**
   * @param {number} key 1 | 2 | 3
   * @param {MaterialBank} bank
   * @param {{detail?: 'full'|'hero', glowTex?: THREE.Texture}} o
   */
  NS.buildModel = function (key, bank, o) {
    var build = BUILDERS[key] || BUILDERS[1];
    var m = build(bank, o || {});
    var info = NS.MODELS && NS.MODELS[key];
    m.finalize(o && o.detail === 'hero' ? [] : (info ? info.components : []));
    return m;
  };
})();
