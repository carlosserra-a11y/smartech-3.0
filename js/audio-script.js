/*!
 * Smartech 3.0 — audio-script.js
 * Roteiro do guia de áudio "A física da ozonólise". É a fonte única do texto:
 *  - no site, vira a transcrição e a narração de reserva (voz do navegador);
 *  - em scripts/generate-audio.mjs, é enviado ao Gemini TTS (gemini-3.8-flash-tts).
 * Escrito para ser falado: números por extenso quando ajuda a pronúncia, sem siglas soltas.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.SmartechAudioScript = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var MODEL = 'gemini-3.8-flash-tts';
  var VOICE = 'Charon';
  var STYLE = 'Narração em português do Brasil, voz calma e segura de engenheiro, tom didático e técnico, ritmo moderado, com pausas curtas entre as frases.';

  var CHAPTERS = [
    {
      id: 'cap1-coccao',
      title: 'Da cocção ao duto',
      text: 'Quando uma chapa ou uma grelha trabalha a mais de duzentos graus, a gordura dos alimentos não fica só na panela. Parte dela evapora e sobe misturada ao ar quente, na forma de vapor e de gotículas microscópicas. Os filtros baffle da coifa retêm as gotas maiores por inércia: o ar faz curvas fechadas entre as palhetas, e a gordura, mais pesada, bate no metal e escorre para a canaleta. Mas o vapor e as partículas mais finas passam. Se nada for feito, eles condensam nas paredes frias do duto e formam uma crosta que alimenta odores e, principalmente, incêndios. É aqui que entra a bateria fotolítica UV-C.'
    },
    {
      id: 'cap2-254nm',
      title: '254 nanômetros: fotólise e ação germicida',
      text: 'A radiação ultravioleta do tipo C carrega muita energia em cada fóton. Essa energia é a constante de Planck vezes a velocidade da luz, dividida pelo comprimento de onda. Em 254 nanômetros, isso dá cerca de 4,9 elétron-volts, mais do que a energia de ligação entre dois átomos de carbono, que fica perto de 3,6 elétron-volts. Quando uma molécula de gordura absorve esse fóton, ligações podem se romper. É a fotólise, que quebra cadeias longas em fragmentos menores e menos aderentes. A mesma faixa de 254 nanômetros fica perto do pico de absorção do DNA, por volta de 260 nanômetros, e por isso inativa bactérias e fungos que passam pelo plenum.'
    },
    {
      id: 'cap3-185nm',
      title: '185 nanômetros: do oxigênio ao ozônio',
      text: 'A segunda linha de emissão das lâmpadas, em 185 nanômetros, é ainda mais energética: perto de 6,7 elétron-volts por fóton. Isso supera a energia que mantém unidos os dois átomos da molécula de oxigênio, de aproximadamente 5,1 elétron-volts. O fóton parte o oxigênio em dois átomos livres, muito reativos. Cada átomo livre se junta a uma molécula de oxigênio intacta e forma o ozônio, O três. Ou seja: a lâmpada fabrica, dentro do plenum, o próprio agente oxidante que vai tratar a gordura, sem produtos químicos e sem reabastecimento.'
    },
    {
      id: 'cap4-ozonolise',
      title: 'Ozonólise: a quebra da dupla ligação',
      text: 'As gorduras de cozinha têm muitos ácidos graxos insaturados, com duplas ligações entre carbonos. O ozônio ataca justamente essas duplas ligações. Ele se encaixa sobre elas e forma um anel instável de três oxigênios, chamado ozonídeo primário. Esse anel se rompe quase imediatamente, e a cadeia de carbono é cortada em dois pedaços: um composto com carbonila, como um aldeído, e um intermediário muito reativo, conhecido como intermediário de Criegee. Esses fragmentos continuam a reagir e viram aldeídos, cetonas e ácidos de cadeia mais curta. Na prática, a gordura pegajosa vira moléculas menores, mais voláteis e menos aderentes, e parte delas é oxidada até gás carbônico e água. Ao mesmo tempo, a luz de 254 nanômetros decompõe parte do ozônio e, na presença de umidade, gera radicais hidroxila, oxidantes ainda mais fortes, que reforçam o tratamento.'
    },
    {
      id: 'cap5-seguranca',
      title: 'Segurança e controle do ozônio residual',
      text: 'Ozônio e radiação UV-C tratam o ar, mas não podem chegar às pessoas. Por isso as lâmpadas ficam no plenum, depois dos filtros e fora da linha de visão, e o comando elétrico faz o intertravamento: a bateria só liga com o exaustor em funcionamento e com os painéis de acesso fechados. O ozônio é gerado dentro do sistema e reage durante o percurso pelo duto, até ser descarregado no exterior, longe de janelas e tomadas de ar. O projeto dimensiona a quantidade de lâmpadas pela vazão, para tratar a gordura sem excesso de ozônio, respeitando os limites de exposição ocupacional, como os da NR-15. E a manutenção continua importante: o UV-C reduz a crosta nos dutos, mas não dispensa a inspeção e a limpeza periódicas.'
    }
  ];

  /** Divide o texto em frases (preserva números decimais como "4,9"). */
  function sentences(text) {
    var out = [];
    var re = /[^.!?]+(?:[.!?]+(?=\s|$)|$)/g;
    var m;
    while ((m = re.exec(text))) {
      var s = m[0].trim();
      if (s) out.push(s);
    }
    return out;
  }

  function wordCount(text) { return String(text).split(/\s+/).filter(Boolean).length; }

  /** Duração estimada (s) para a fala em português num ritmo didático. */
  function estimateSeconds(text, wpm) { return Math.max(1, Math.round((wordCount(text) / (wpm || 150)) * 60)); }

  return { MODEL: MODEL, VOICE: VOICE, STYLE: STYLE, CHAPTERS: CHAPTERS, sentences: sentences, wordCount: wordCount, estimateSeconds: estimateSeconds };
});
