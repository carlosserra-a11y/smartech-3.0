/* Smartech 3.0 — 3d/materials.js
 * Banco de materiais por componente e materiais do modo Raio-X.
 *
 * Correção do Raio-X (por que o interior não aparecia):
 *  1. Todos os materiais de componente nascem com transparent: true, opacity: 1 e depthWrite: true.
 *     Assim a opacidade é interpolada a cada quadro sem trocar o pipeline de transparência
 *     (nenhum material.needsUpdate, nenhum programa WebGL recompilado no meio da animação).
 *  2. Carcaça (shell): renderOrder 10 e depthWrite: false quando translúcida;
 *     órgãos internos: renderOrder 1 e depthWrite: true → a GPU desenha o interior primeiro
 *     e a "pele" safira/blueprint é aplicada por cima, sem apagar o que está dentro.
 *  3. Os planos de corte (clippingPlanes) também existem desde a criação: o corte frontal
 *     só move a constante do plano, sem recompilar shaders.
 */
(function () {
  'use strict';

  var THREE = window.THREE;
  var NS = (window.Smartech3D = window.Smartech3D || {});

  var COLORS = {
    gold: 0xfacc15,
    cyan: 0x0284c7,
    cyanBright: 0x38bdf8,
    uv: 0xa855f7,
    uvSoft: 0xe9d5ff
  };
  NS.COLORS = COLORS;

  var RENDER_ORDER = { internal: 1, halo: 2, smoke: 5, glow: 6, shell: 10, skin: 11, edges: 12, highlight: 20 };
  NS.RENDER_ORDER = RENDER_ORDER;

  /** Receitas base (PBR). Cada componente recebe sua própria instância para poder ser isolado. */
  var BASE = {
    shell: { color: 0xc4cdd3, metalness: 0.92, roughness: 0.32 },
    shellSide: { color: 0xa8b2b9, metalness: 0.92, roughness: 0.38 },
    inox: { color: 0xb6bfc5, metalness: 0.9, roughness: 0.36 },
    inoxDark: { color: 0x87929a, metalness: 0.88, roughness: 0.4 },
    vane: { color: 0xadb7be, metalness: 0.92, roughness: 0.28 },
    mirror: { color: 0xf3f6f8, metalness: 1, roughness: 0.05 },
    quartz: { color: 0xdbe2ea, metalness: 0, roughness: 0.18, emissive: COLORS.uv, emissiveIntensity: 0 },
    ceramic: { color: 0xece6d8, metalness: 0, roughness: 0.48 },
    brass: { color: 0xb88a3e, metalness: 1, roughness: 0.3 },
    gold: { color: COLORS.gold, metalness: 0.85, roughness: 0.3, emissive: 0x3b3000, emissiveIntensity: 0.55 },
    graphite: { color: 0x2b333a, metalness: 0.45, roughness: 0.55 },
    conduit: { color: 0x22282d, metalness: 0.25, roughness: 0.7 },
    dark: { color: 0x1d2429, metalness: 0.6, roughness: 0.5 },
    fan: { color: 0x3b4751, metalness: 0.75, roughness: 0.4 },
    led: { color: 0x14532d, metalness: 0, roughness: 0.4, emissive: 0x22c55e, emissiveIntensity: 0 }
  };

  function makeSkinMaterial(cutPlane) {
    // "Pele" safira do Raio-X: fresnel aditivo que se intensifica nos contornos da carcaça
    return new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(COLORS.cyanBright) },
        uOpacity: { value: 0 },
        uPower: { value: 2.1 }
      },
      vertexShader: [
        '#include <common>',
        '#include <clipping_planes_pars_vertex>',
        'varying vec3 vNormalV;',
        'varying vec3 vViewDir;',
        'void main() {',
        '  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);',
        '  vNormalV = normalize(normalMatrix * normal);',
        '  vViewDir = normalize(-mvPosition.xyz);',
        '  gl_Position = projectionMatrix * mvPosition;',
        '  #include <clipping_planes_vertex>',
        '}'
      ].join('\n'),
      fragmentShader: [
        '#include <common>',
        '#include <clipping_planes_pars_fragment>',
        'uniform vec3 uColor;',
        'uniform float uOpacity;',
        'uniform float uPower;',
        'varying vec3 vNormalV;',
        'varying vec3 vViewDir;',
        'void main() {',
        '  #include <clipping_planes_fragment>',
        '  float facing = abs(dot(normalize(vNormalV), normalize(vViewDir)));',
        '  float rim = pow(1.0 - facing, uPower);',
        '  float alpha = uOpacity * (0.05 + 0.95 * rim);',
        '  gl_FragColor = vec4(uColor * (0.35 + 1.25 * rim), alpha);',
        '}'
      ].join('\n'),
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      clipping: true,
      clippingPlanes: [cutPlane]
    });
  }

  function MaterialBank(cutPlane, opts) {
    this.cutPlane = cutPlane;
    this.opts = opts || {};
    this.cache = {};
    this.all = [];
    this.byCid = {};
    this.skin = makeSkinMaterial(cutPlane);
    this.edges = new THREE.LineBasicMaterial({ color: COLORS.cyanBright, transparent: true, opacity: 0, depthWrite: false, clippingPlanes: [cutPlane] });
  }

  /**
   * Material de componente.
   * @param {string} cid componente (isolamento/destaque são por componente)
   * @param {string} key receita em BASE
   * @param {{shell?:boolean, double?:boolean, context?:boolean}} [o]
   */
  MaterialBank.prototype.get = function (cid, key, o) {
    o = o || {};
    var id = cid + '|' + key + (o.shell ? '|s' : '') + (o.double ? '|d' : '');
    if (this.cache[id]) return this.cache[id];
    var b = BASE[key] || BASE.inox;
    var m = new THREE.MeshStandardMaterial({
      color: b.color,
      metalness: b.metalness,
      roughness: b.roughness,
      emissive: b.emissive !== undefined ? b.emissive : 0x000000,
      emissiveIntensity: b.emissiveIntensity || 0,
      transparent: true,          // (1) transparência ativa desde a criação
      opacity: 1,
      depthWrite: true,
      side: o.shell || o.double ? THREE.DoubleSide : THREE.FrontSide,
      clippingPlanes: o.shell ? [this.cutPlane] : null   // (3) plano de corte fixo desde a criação
    });
    m.userData = { cid: cid, key: key, shell: !!o.shell, context: !!o.context, ghost: 0, baseEmissive: m.emissiveIntensity };
    this.cache[id] = m;
    this.all.push(m);
    (this.byCid[cid] = this.byCid[cid] || []).push(m);
    return m;
  };

  /** Brilhos aditivos (halo das lâmpadas, clarão UV sob a coifa). Não entram no isolamento. */
  MaterialBank.prototype.additive = function (cid, color, map) {
    var m = new THREE.MeshBasicMaterial({
      color: color,
      map: map || null,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide
    });
    m.userData = { cid: cid, additive: true };
    this.all.push(m);
    return m;
  };

  MaterialBank.prototype.dispose = function () {
    this.all.forEach(function (m) { m.dispose(); });
    this.skin.dispose();
    this.edges.dispose();
    this.all = [];
    this.cache = {};
    this.byCid = {};
  };

  NS.MaterialBank = MaterialBank;
})();
