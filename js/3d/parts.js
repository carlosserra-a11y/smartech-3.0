/* Smartech 3.0 — 3d/parts.js
 * Biblioteca de peças paramétricas (unidades em metros).
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var NS = window.Smartech3D;
  var P = (NS.parts = {});

  P.mesh = function (geo, mat, x, y, z) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x || 0, y || 0, z || 0);
    return m;
  };
  P.box = function (w, h, d, mat, x, y, z) { return P.mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z); };
  P.cyl = function (rt, rb, h, seg, mat, x, y, z, open) { return P.mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1, !!open), mat, x, y, z); };

  /** Perfil em U (canaleta) extrudado ao longo de Z, centrado na origem. */
  P.uChannelGeometry = function (len, w, h, t) {
    w = w || 0.06; h = h || 0.04; t = t || 0.004;
    var s = new THREE.Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(w / 2 - t, h);
    s.lineTo(w / 2 - t, t); s.lineTo(-w / 2 + t, t); s.lineTo(-w / 2 + t, h); s.lineTo(-w / 2, h); s.lineTo(-w / 2, 0);
    var g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false });
    g.translate(0, 0, -len / 2);
    return g;
  };
  /** Canaleta ao longo de X, com caimento (rad) descendo para +X. */
  P.channelX = function (len, mat, x, y, z, slope) {
    var g = P.uChannelGeometry(len);
    g.rotateY(Math.PI / 2);
    var m = P.mesh(g, mat, x, y, z);
    m.rotation.z = -(slope || 0);
    return m;
  };
  /** Canaleta ao longo de Z, com caimento (rad) descendo para −Z (fundo). */
  P.channelZ = function (len, mat, x, y, z, slope) {
    var m = P.mesh(P.uChannelGeometry(len), mat, x, y, z);
    m.rotation.x = -(slope || 0);
    return m;
  };

  /**
   * Transição aerodinâmica: base "squircle" (a × b) → topo circular (r), com perfil suave.
   * Gera o pleno cônico entre a câmara de exaustão e o colarinho.
   */
  P.loftGeometry = function (o) {
    var seg = o.segments || 64, rings = o.rings || 12, pw = 2 / (o.p || 4);
    var pos = [], idx = [];
    for (var r = 0; r <= rings; r++) {
      var v = r / rings;
      var e = v * v * (3 - 2 * v);
      var y = o.y0 + (o.y1 - o.y0) * v;
      for (var s = 0; s <= seg; s++) {
        var ang = (s / seg) * Math.PI * 2;
        var c = Math.cos(ang), sn = Math.sin(ang);
        var bx = o.a * Math.sign(c) * Math.pow(Math.abs(c), pw);
        var bz = o.b * Math.sign(sn) * Math.pow(Math.abs(sn), pw);
        pos.push(bx + (o.r * c - bx) * e, y, bz + (o.r * sn - bz) * e);
      }
    }
    for (r = 0; r < rings; r++) {
      for (s = 0; s < seg; s++) {
        var a0 = r * (seg + 1) + s, a1 = a0 + 1, b0 = a0 + seg + 1, b1 = b0 + 1;
        idx.push(a0, b0, a1, a1, b0, b1);
      }
    }
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  };

  /**
   * Refletor parabólico espelhado: perfil y = x²/(4f) com a lâmpada no foco F = (fz, fy),
   * abertura na direção unitária (oz, oy) do plano Z-Y, extrudado ao longo de X (comprimento len).
   */
  P.reflectorGeometry = function (len, fz, fy, oz, oy, f, a, t) {
    f = f || 0.025; a = a || 0.075; t = t || 0.003;
    var tz = -oy, ty = oz;                         // tangente = abertura girada +90°
    var vz = fz - oz * f, vy = fy - oy * f;        // vértice da parábola
    var N = 20, inner = [], outer = [];
    for (var i = 0; i <= N; i++) {
      var px = -a + (2 * a * i) / N, py = (px * px) / (4 * f);
      inner.push([vz + tz * px + oz * py, vy + ty * px + oy * py]);
      outer.push([vz + tz * px + oz * (py - t), vy + ty * px + oy * (py - t)]);
    }
    var s = new THREE.Shape();
    s.moveTo(inner[0][0], inner[0][1]);
    for (i = 1; i <= N; i++) s.lineTo(inner[i][0], inner[i][1]);
    for (i = N; i >= 0; i--) s.lineTo(outer[i][0], outer[i][1]);
    s.lineTo(inner[0][0], inner[0][1]);
    var g = new THREE.ExtrudeGeometry(s, { depth: len, bevelEnabled: false, curveSegments: 1 });
    g.rotateY(-Math.PI / 2);                       // (x, y, z) → (−z, y, x): perfil no plano Z-Y
    g.translate(len / 2, 0, 0);
    return g;
  };

  /** Lâmpada tubular de quartzo (T8, Ø 25,4 mm) com eletrodos e halo de emissão. */
  P.lamp = function (len, quartz, band, halo) {
    var g = new THREE.Group();
    var tube = P.mesh(new THREE.CylinderGeometry(0.0127, 0.0127, len, 20), quartz);
    tube.rotation.z = Math.PI / 2;
    g.add(tube);
    [-1, 1].forEach(function (s) {
      var b = P.mesh(new THREE.CylinderGeometry(0.0133, 0.0133, 0.035, 20), band, s * (len / 2 - 0.0175), 0, 0);
      b.rotation.z = Math.PI / 2;
      g.add(b);
    });
    var h = P.mesh(new THREE.CylinderGeometry(0.036, 0.036, len * 0.97, 18, 1, true), halo);
    h.rotation.z = Math.PI / 2;
    h.renderOrder = NS.RENDER_ORDER.halo;
    h.userData.noPick = true;
    g.add(h);
    return g;
  };

  /** Soquete cerâmico G13 (bipino, 12,7 mm entre pinos). dir = lado em que fica a lâmpada (±1 em X). */
  P.socketG13 = function (ceramic, pin, dir) {
    var g = new THREE.Group();
    g.add(P.box(0.03, 0.05, 0.042, ceramic));
    [-0.00635, 0.00635].forEach(function (z) {
      var p = P.mesh(new THREE.CylinderGeometry(0.0012, 0.0012, 0.012, 8), pin, dir * 0.019, 0, z);
      p.rotation.z = Math.PI / 2;
      g.add(p);
    });
    return g;
  };

  /**
   * Banco de filtros baffle: cassetes modulares com palhetas em chevron (labirinto).
   * Coordenadas locais: X = comprimento da coifa, Y = altura do filtro (subindo a inclinação),
   * Z = normal ao filtro (sentido do fluxo). As palhetas são instanciadas (1 draw call).
   */
  P.baffleBank = function (o, frame, vane) {
    var g = new THREE.Group();
    var cw = (o.width - (o.count - 1) * o.gap) / o.count;
    var per = o.vanes || 9;
    var plate = new THREE.BoxGeometry(0.045, o.height - 0.05, 0.004);
    var inst = new THREE.InstancedMesh(plate, vane, o.count * per * 2);
    var m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3();
    var k = 0;
    for (var c = 0; c < o.count; c++) {
      var cx = -o.width / 2 + cw / 2 + c * (cw + o.gap);
      g.add(P.box(cw, 0.024, 0.045, frame, cx, o.height / 2 - 0.012, 0));
      g.add(P.box(cw, 0.024, 0.045, frame, cx, -o.height / 2 + 0.012, 0));
      g.add(P.box(0.024, o.height, 0.045, frame, cx - cw / 2 + 0.012, 0, 0));
      g.add(P.box(0.024, o.height, 0.045, frame, cx + cw / 2 - 0.012, 0, 0));
      g.add(P.box(0.06, 0.016, 0.02, frame, cx, -o.height / 2 + 0.04, 0.03));        // puxador
      var pitch = (cw - 0.05) / per;
      for (var v = 0; v < per; v++) {
        var vx = cx - cw / 2 + 0.025 + pitch * (v + 0.5);
        for (var s = -1; s <= 1; s += 2) {
          e.set(0, s * 0.8, 0);
          q.setFromEuler(e);
          p.set(vx + s * 0.009, 0, s * 0.011);
          m4.compose(p, q, sc);
          inst.setMatrixAt(k++, m4);
        }
      }
    }
    inst.instanceMatrix.needsUpdate = true;
    g.add(inst);
    return g;
  };

  /** Válvula de esfera de 1/2" (Ø 21,3 mm) com niple, corpo em latão e alavanca. Eixo vertical. */
  P.ballValve = function (inox, brass, handle) {
    var g = new THREE.Group();
    g.add(P.cyl(0.01065, 0.01065, 0.06, 16, inox, 0, -0.03, 0));
    var body = P.mesh(new THREE.SphereGeometry(0.022, 20, 14), brass, 0, -0.07, 0);
    body.scale.set(1, 0.85, 1);
    g.add(body);
    g.add(P.cyl(0.015, 0.015, 0.018, 6, brass, 0, -0.045, 0));
    g.add(P.cyl(0.015, 0.015, 0.018, 6, brass, 0, -0.095, 0));
    g.add(P.cyl(0.01065, 0.01065, 0.03, 16, inox, 0, -0.118, 0));
    var stem = P.cyl(0.004, 0.004, 0.024, 10, brass, 0, -0.07, 0.024);
    stem.rotation.x = Math.PI / 2;
    g.add(stem);
    g.add(P.box(0.085, 0.008, 0.016, handle, 0.03, -0.07, 0.038));
    return g;
  };

  /** Damper borboleta no colarinho (raio r): lâmina, eixo e quadrante com alavanca externa em +X. */
  P.butterflyDamper = function (r, blade, shaft, plate, handle, angle) {
    var g = new THREE.Group();
    var b = new THREE.Group();
    b.add(P.cyl(r, r, 0.008, 48, blade));
    b.rotation.x = angle === undefined ? 0.6 : angle;
    g.add(b);
    var sh = P.cyl(0.008, 0.008, 2 * r + 0.14, 12, shaft);
    sh.rotation.z = Math.PI / 2;
    g.add(sh);
    var lever = new THREE.Group();
    lever.position.x = r + 0.06;
    lever.add(P.box(0.006, 0.075, 0.095, plate));
    var arm = P.box(0.012, 0.012, 0.115, handle, 0.012, 0, 0.03);
    arm.rotation.x = b.rotation.x;
    lever.add(arm);
    var nut = P.cyl(0.013, 0.013, 0.012, 8, handle, 0.016, 0.028, 0.03);
    nut.rotation.z = Math.PI / 2;
    lever.add(nut);
    g.add(lever);
    g.userData.blade = b;
    g.userData.lever = lever;
    return g;
  };

  /** Caixa de comando elétrico IP65 (apoiada em y = 0), porta frontal (+Z) e prensa-cabos em +X. */
  P.controlBox = function (body, seam, label, gland, led) {
    var g = new THREE.Group();
    g.add(P.box(0.36, 0.24, 0.16, body, 0, 0.12, 0));
    g.add(P.box(0.33, 0.21, 0.004, seam, 0, 0.12, 0.081));
    g.add(P.box(0.12, 0.026, 0.003, label, -0.07, 0.195, 0.0845));
    g.add(P.box(0.02, 0.06, 0.012, seam, 0.15, 0.12, 0.088));                  // fecho
    var l = P.mesh(new THREE.SphereGeometry(0.008, 12, 8), led, 0.09, 0.195, 0.085);
    g.add(l);
    [0.06, 0.16].forEach(function (y) {
      var gl = P.cyl(0.013, 0.013, 0.028, 14, gland, 0.194, y, 0);
      gl.rotation.z = Math.PI / 2;
      g.add(gl);
    });
    g.userData.led = l;
    return g;
  };

  /** Reator eletrônico blindado IP65 (apoiado em y = 0, comprimento em X). */
  P.ballast = function (body, fin) {
    var g = new THREE.Group();
    g.add(P.box(0.4, 0.05, 0.07, body, 0, 0.025, 0));
    for (var i = 0; i < 6; i++) g.add(P.box(0.004, 0.01, 0.072, fin, -0.15 + i * 0.06, 0.055, 0));
    [-0.21, 0.21].forEach(function (x) { g.add(P.box(0.02, 0.012, 0.09, fin, x, 0.006, 0)); });
    return g;
  };

  /** Conduíte flexível por pontos [[x,y,z], ...]. */
  P.conduit = function (points, radius, mat) {
    var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
    return new THREE.Mesh(new THREE.TubeGeometry(curve, 72, radius, 8, false), mat);
  };

  /** Rotor centrífugo (eixo Z) com pás curvadas para trás. */
  P.impeller = function (r, depth, hub, blade) {
    var g = new THREE.Group();
    var h = P.cyl(r * 0.22, r * 0.22, depth * 1.05, 24, hub);
    h.rotation.x = Math.PI / 2;
    g.add(h);
    var back = P.cyl(r, r, 0.01, 48, hub, 0, 0, -depth / 2);
    back.rotation.x = Math.PI / 2;
    g.add(back);
    var ring = P.mesh(new THREE.TorusGeometry(r * 0.96, 0.012, 8, 48), hub, 0, 0, depth / 2);
    g.add(ring);
    var n = 14;
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var b = P.box(r * 0.56, 0.012, depth, blade, Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, 0);
      b.rotation.z = a + 0.55;
      g.add(b);
    }
    return g;
  };

  /** Equipamento de cocção (contexto visual, não clicável). */
  P.cooktop = function (w, d, body, trim, plate, n) {
    var g = new THREE.Group();
    g.add(P.box(w, 0.14, d, body));
    g.add(P.box(w + 0.02, 0.02, d + 0.02, trim, 0, 0.08, 0));
    var step = w / (n || 4);
    for (var i = 0; i < (n || 4); i++) g.add(P.cyl(0.17, 0.17, 0.02, 28, plate, -w / 2 + step * (i + 0.5), 0.085, 0));
    g.traverse(function (o) { o.userData.noPick = true; });
    return g;
  };
})();
