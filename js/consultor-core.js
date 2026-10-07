/*!
 * Smartech 3.0 — consultor-core.js
 * Núcleo do consultor técnico (sem DOM): base técnica local, busca por palavras-chave
 * e conversão de texto da IA (markdown simples) em blocos seguros para renderização.
 * UMD: window.SmartechConsult no navegador; module.exports no Node (testes).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmartechConsult = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var KB = [
    {
      id: 'nbr14518',
      q: 'O que a NBR 14518 exige de um sistema de exaustão?',
      keys: ['nbr', '14518', 'norma', 'abnt', 'exige', 'exigencia', 'requisito', 'bombeiro', 'bombeiros', 'aprovacao', 'cbmsc', 'legislacao'],
      answer: [
        'A ABNT NBR 14518 trata dos sistemas de ventilação para cozinhas profissionais: captação (coifas), filtragem de gordura, dutos, exaustores e a segurança contra incêndio do conjunto.',
        'Na prática, o projeto define a vazão de cada coifa, o tipo de filtro, a construção estanque e o traçado dos dutos, os acessos para inspeção e limpeza e a descarga do ar no exterior.',
        'As exigências de aprovação variam por município e pelo Corpo de Bombeiros de cada estado (em Santa Catarina, as instruções normativas do CBMSC). Por isso o dimensionamento final é feito em projeto, com responsável técnico e ART.'
      ],
      link: { href: '#calculator', text: 'Fazer um pré-dimensionamento' }
    },
    {
      id: 'uv-254-185',
      q: 'Qual a diferença entre as lâmpadas de 254 nm e de 185 nm?',
      keys: ['254', '185', 'nm', 'nanometro', 'nanometros', 'diferenca', 'comprimento', 'onda', 'germicida', 'fotolise', 'faixa'],
      answer: [
        'A linha de 254 nm (UV-C germicida) tem fótons de cerca de 4,9 eV. Ela rompe ligações de moléculas orgânicas da gordura (fotólise) e inativa microrganismos, porque fica perto do pico de absorção do DNA.',
        'A linha de 185 nm tem fótons de cerca de 6,7 eV, energia suficiente para partir a molécula de oxigênio. Os átomos livres formam ozônio, que oxida as duplas ligações da gordura (ozonólise).',
        'Na bateria Smartech as duas atuam em conjunto no plenum, depois dos filtros baffle.'
      ],
      link: { href: '#guia-audio', text: 'Ouvir o guia sobre ozonólise' }
    },
    {
      id: 'ozonio-seguranca',
      q: 'O ozônio gerado pela coifa é perigoso?',
      keys: ['ozonio', 'perigoso', 'perigo', 'seguranca', 'saude', 'toxico', 'cheiro', 'nr15', 'exposicao', 'intertravamento', 'risco'],
      answer: [
        'Em concentração elevada, o ozônio irrita as vias respiratórias. Por isso ele é gerado e consumido dentro do sistema: as lâmpadas ficam no plenum, depois dos filtros, e o ar tratado segue pelo duto até a descarga no exterior.',
        'O comando elétrico faz o intertravamento: a bateria UV-C só liga com o exaustor funcionando e com os painéis fechados, o que também protege olhos e pele da radiação.',
        'O número de lâmpadas é dimensionado pela vazão para evitar excesso de ozônio, respeitando os limites de exposição ocupacional (NR-15).'
      ]
    },
    {
      id: 'manutencao',
      q: 'Qual a manutenção dos filtros e das lâmpadas UV-C?',
      keys: ['manutencao', 'limpeza', 'limpar', 'lavar', 'lavagem', 'filtro', 'filtros', 'troca', 'trocar', 'vida', 'util', 'lampada', 'lampadas', 'frequencia', 'periodicidade', 'quartzo'],
      answer: [
        'Os filtros baffle em inox são laváveis. A frequência depende do volume de fritura e de grelha e pode ir de alguns dias a algumas semanas. A canaleta deve ser esvaziada pela válvula de dreno.',
        'As lâmpadas UV-C perdem intensidade com o tempo e são trocadas pelo horímetro, conforme a vida útil indicada pelo fabricante. Os tubos de quartzo precisam ser limpos, porque gordura na superfície bloqueia a radiação.',
        'O UV-C reduz a crosta nos dutos, mas não dispensa a inspeção e a limpeza periódicas do sistema.'
      ]
    },
    {
      id: 'vazao-calculo',
      q: 'Como calcular a vazão de exaustão de uma coifa?',
      keys: ['vazao', 'calcular', 'calculo', 'm3', 'm3h', 'cfm', 'captura', 'area', 'formula', 'dimensionar', 'dimensionamento', 'tamanho'],
      answer: [
        'No método por velocidade de captura, a vazão é Q = A × V × 3600, com A em m² (comprimento × profundidade da coifa), V em m/s e Q em m³/h.',
        'A velocidade de captura depende da carga térmica do equipamento: cerca de 0,25 m/s para cargas leves e até 0,50 m/s para grelhas e carvão. Coifas de ilha, abertas nos quatro lados, pedem vazão maior.',
        'Use a calculadora para o pré-dimensionamento; o valor final é confirmado em projeto.'
      ],
      link: { href: '#calculator', text: 'Abrir a calculadora' }
    },
    {
      id: 'duto-10ms',
      q: 'Por que dimensionar o duto para cerca de 10 m/s?',
      keys: ['duto', 'dutos', 'diametro', 'velocidade', '10', 'tubulacao', 'perda', 'carga', 'ruido', 'deposito'],
      answer: [
        'Com velocidade adequada, as partículas de gordura seguem em suspensão e se depositam menos nas paredes do duto; velocidades muito altas aumentam a perda de carga e o ruído.',
        'A calculadora usa 10 m/s como referência: a área do duto é Q ÷ (3600 × 10) e o diâmetro é arredondado para o tamanho comercial imediatamente acima, o que mantém a velocidade real um pouco abaixo disso.',
        'A velocidade definitiva segue a NBR 14518 e as condições de cada instalação.'
      ]
    },
    {
      id: 'uv-dispensa-limpeza',
      q: 'A tecnologia UV-C dispensa a limpeza dos dutos?',
      keys: ['dispensa', 'dispensar', 'substitui', 'elimina', 'precisa', 'continuar', 'limpeza', 'duto'],
      answer: [
        'Não. A bateria UV-C reduz a gordura que chega ao duto e retarda a formação de crosta, o que diminui a frequência de limpezas pesadas.',
        'Inspeções e limpezas periódicas continuam necessárias, conforme a norma, as exigências locais e o uso da cozinha.'
      ]
    },
    {
      id: 'inox-304',
      q: 'Por que usar inox AISI 304 e não 430?',
      keys: ['inox', '304', '430', 'aco', 'material', 'corrosao', 'ferritico', 'austenitico', 'chapa', 'oxidar'],
      answer: [
        'O AISI 304 é um aço inoxidável austenítico, com cromo e níquel, que resiste melhor à corrosão provocada por umidade, vapor e produtos de limpeza usados em cozinhas.',
        'O AISI 430 é ferrítico, sem níquel: é mais barato, mas tende a manchar e oxidar com mais facilidade em ambientes agressivos.',
        'Para coifas, canaletas e filtros que recebem gordura quente e lavagens frequentes, o 304 oferece maior durabilidade.'
      ]
    },
    {
      id: 'damper',
      q: 'Para que serve o damper borboleta no colarinho?',
      keys: ['damper', 'borboleta', 'registro', 'regular', 'regulagem', 'tiragem', 'balancear', 'balanceamento', 'colarinho'],
      answer: [
        'O damper borboleta é uma lâmina que gira no colarinho e ajusta a resistência ao escoamento. Ele balanceia a vazão quando várias coifas compartilham o mesmo exaustor e regula a tiragem estática.',
        'Em dutos de gordura, o tipo, a posição e o travamento de dampers precisam atender à NBR 14518 e ao projeto, para não acumular gordura nem comprometer a segurança contra incêndio.'
      ]
    },
    {
      id: 'dreno',
      q: 'Para onde vai a gordura recolhida na canaleta?',
      keys: ['dreno', 'drenagem', 'canaleta', 'calha', 'descarte', 'residuo', 'valvula', 'esgoto', 'condensado', 'caimento', 'oleo'],
      answer: [
        'A canaleta perimetral tem caimento de 1,5% e conduz gordura e condensado até a válvula de dreno de 1/2", no ponto mais baixo.',
        'O resíduo deve ser coletado em recipiente e ter destinação adequada, por exemplo a reciclagem de óleo. Ele não deve ser lançado diretamente na rede de esgoto sem caixa de gordura.'
      ]
    },
    {
      id: 'ip65',
      q: 'O que significa o grau de proteção IP65 do comando elétrico?',
      keys: ['ip65', 'ip', 'protecao', 'eletrico', 'eletrica', 'comando', 'reator', 'reatores', 'caixa', 'agua', 'poeira'],
      answer: [
        'IP65 indica, pela norma de graus de proteção IEC 60529, que o invólucro é totalmente protegido contra poeira (dígito 6) e contra jatos de água (dígito 5).',
        'Isso é importante em cozinhas profissionais, com gordura no ar e lavagens frequentes. Os reatores eletrônicos das lâmpadas UV-C ficam fora da zona de gordura e se ligam aos soquetes por conduítes flexíveis vedados.'
      ]
    },
    {
      id: 'orcamento',
      q: 'Como solicitar um orçamento e um projeto?',
      keys: ['orcamento', 'preco', 'valor', 'custo', 'custa', 'quanto', 'visita', 'prazo', 'contratar', 'comprar', 'proposta'],
      answer: [
        'Envie as medidas da cozinha e os equipamentos pelo formulário ou pelo WhatsApp (48) 99180-9488. Se quiser, anexe o relatório da calculadora para agilizar a análise.',
        'A engenharia da Smartech confirma o dimensionamento, propõe a solução e emite o projeto com responsável técnico.'
      ],
      link: { href: '#contact', text: 'Ir para o formulário de orçamento' }
    }
  ];

  var STOP = ' a o as os de da do das dos e em um uma uns umas para por com sem que qual quais como se no na nos nas ao aos ou mais menos muito pra pro me te lhe isso esse essa este esta sao ser e eh tem ter voces voce minha meu sua seu '.split(' ').reduce(function (m, w) { if (w) m[w] = 1; return m; }, {});

  function normalize(text) {
    return String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function tokens(text) {
    return normalize(text).split(' ').filter(function (t) { return t && !STOP[t]; });
  }

  function score(entry, toks) {
    var s = 0;
    var keys = entry._keys || (entry._keys = entry.keys.map(normalize));
    var title = entry._title || (entry._title = tokens(entry.q));
    toks.forEach(function (t) {
      keys.forEach(function (k) {
        if (t === k) s += 2;
        else if (k.length >= 5 && t.length >= 5 && (t.indexOf(k.slice(0, 5)) === 0 || k.indexOf(t.slice(0, 5)) === 0)) s += 1;
      });
      if (title.indexOf(t) >= 0) s += 0.5;
    });
    return s;
  }

  /** Melhor resposta da base local (ou null) + perguntas relacionadas. */
  function answerLocal(question) {
    var toks = tokens(question);
    var ranked = KB.map(function (e) { return { e: e, s: score(e, toks) }; }).sort(function (a, b) { return b.s - a.s; });
    var best = ranked[0] && ranked[0].s >= 2 ? ranked[0].e : null;
    var related = ranked.filter(function (r) { return r.e !== best && r.s > 0; }).slice(0, 3).map(function (r) { return r.e; });
    if (related.length < 3) {
      KB.forEach(function (e) { if (related.length < 3 && e !== best && related.indexOf(e) < 0) related.push(e); });
    }
    return { entry: best, related: related };
  }

  function suggestions(n) { return KB.slice(0, n || 6).map(function (e) { return e.q; }); }

  /** Inline: **negrito**, [texto](https://url) e URLs soltas → partes seguras. */
  function inline(text) {
    var parts = [];
    var re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?])/g;
    var last = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > last) parts.push({ t: 'text', v: text.slice(last, m.index) });
      if (m[1]) parts.push({ t: 'b', v: m[1] });
      else if (m[2]) parts.push({ t: 'a', v: m[2], href: m[3] });
      else if (m[4]) parts.push({ t: 'a', v: m[4], href: m[4] });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ t: 'text', v: text.slice(last) });
    return parts;
  }

  /** Markdown simples → blocos { type: 'p' | 'ul' | 'h', ... } (nunca HTML bruto). */
  function toBlocks(text) {
    var lines = String(text || '').replace(/\r\n?/g, '\n').split('\n');
    var blocks = [], para = [], list = null;
    function flushPara() { if (para.length) { blocks.push({ type: 'p', parts: inline(para.join(' ')) }); para = []; } }
    function flushList() { if (list) { blocks.push(list); list = null; } }
    lines.forEach(function (raw) {
      var line = raw.trim();
      var item = /^(?:[-*•]|\d+[.)])\s+(.*)$/.exec(line);
      var head = /^#{1,4}\s+(.*)$/.exec(line);
      if (!line) { flushPara(); flushList(); return; }
      if (head) { flushPara(); flushList(); blocks.push({ type: 'h', parts: inline(head[1].replace(/\*\*/g, '')) }); return; }
      if (item) { flushPara(); if (!list) list = { type: 'ul', items: [] }; list.items.push(inline(item[1])); return; }
      flushList();
      para.push(line);
    });
    flushPara();
    flushList();
    return blocks;
  }

  function isSafeUrl(url) { return /^https?:\/\/[^\s]+$/i.test(String(url || '')); }

  return { KB: KB, normalize: normalize, tokens: tokens, answerLocal: answerLocal, suggestions: suggestions, toBlocks: toBlocks, inline: inline, isSafeUrl: isSafeUrl };
});
