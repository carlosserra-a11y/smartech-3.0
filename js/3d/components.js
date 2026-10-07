/* Smartech 3.0 — 3d/components.js
 * Fichas técnicas dos componentes (conteúdo da gaveta, das anotações 3D e da lista lateral)
 * e descrição dos modelos. Sem dependência do three.js.
 */
(function () {
  'use strict';

  var NS = (window.Smartech3D = window.Smartech3D || {});

  NS.COMPONENTS = {
    carcaca: {
      name: 'Carcaça em aço inox AISI 304',
      note: 'inox 304 · costuras estanques',
      meta: ['Estrutura externa', 'Aço inox AISI 304 escovado', 'Sob medida'],
      text: 'Envolve a zona de captação e conduz o ar engordurado até os filtros. As costuras são soldadas ou seladas para que gordura e condensado não escorram para fora da coifa.',
      specs: [['Material', 'Aço inox AISI 304'], ['Acabamento', 'Escovado'], ['Uniões', 'Soldadas ou seladas, estanques'], ['Dimensões no modelo', '3,00 × 1,20 × 0,75 m']],
      footnote: 'Espessura de chapa e reforços definidos em projeto, conforme as dimensões e a NBR 14518.'
    },
    damper: {
      name: 'Colarinho e damper borboleta',
      note: 'regulador de tiragem estática',
      meta: ['Conexão ao duto', 'Lâmina borboleta', 'Alavanca com trava'],
      text: 'O colarinho superior liga a coifa ao duto. A lâmina borboleta gira sobre um eixo transversal e ajusta a resistência ao escoamento: serve para regular a tiragem estática e balancear a vazão entre coifas que compartilham o mesmo exaustor.',
      specs: [['Diâmetro', 'Conforme a vazão (ver calculadora)'], ['Acionamento', 'Alavanca externa com quadrante'], ['Abertura no modelo', '≈ 34°'], ['Material', 'Aço inox AISI 304']],
      footnote: 'Em dutos de gordura, o tipo, a posição e o travamento de dampers devem atender à NBR 14518 e ao projeto.'
    },
    pleno: {
      name: 'Pleno cônico aerodinâmico',
      note: 'transição retangular → circular',
      meta: ['Componente interno', 'Inox AISI 304', 'Baixa perda de carga'],
      text: 'Transição entre a câmara de exaustão e o colarinho. A seção passa gradualmente de retangular a circular, o que reduz turbulência e perda de carga localizada e distribui melhor a sucção ao longo dos filtros.',
      specs: [['Geometria', 'Squircle → círculo, perfil suave'], ['Base no modelo', '1,44 × 0,34 m'], ['Saída', 'Ø do colarinho'], ['Função', 'Uniformizar a sucção']],
      footnote: ''
    },
    uv: {
      name: 'Bateria fotolítica UV-C',
      note: '254 nm germicida · 185 nm ozonólise',
      meta: ['Componente interno', 'Plenum, após os filtros', '4 lâmpadas em 2 fileiras'],
      text: 'Lâmpadas tubulares de quartzo instaladas no plenum, depois dos filtros. A emissão de 254 nm quebra ligações das moléculas de gordura (fotólise) e inativa microrganismos; a de 185 nm transforma oxigênio em ozônio, que oxida os vapores de gordura (ozonólise).',
      specs: [['Comprimentos de onda', '254 nm · 185 nm'], ['Tubo', 'Quartzo, T8 (Ø 25,4 mm)'], ['No modelo', '2 × 254 nm + 2 × 185 nm, 1,2 m'], ['Emissão (visualização)', 'Violeta #a855f7']],
      footnote: 'Intertravamento: as lâmpadas só ligam com o exaustor em funcionamento e com os painéis fechados (UV-C e ozônio não podem atingir pessoas).'
    },
    refletor: {
      name: 'Refletores parabólicos e soquetes G13',
      note: 'refletor espelhado · soquete cerâmico',
      meta: ['Componente interno', 'Perfil parabólico', 'Soquete cerâmico G13'],
      text: 'Cada lâmpada fica no foco de um refletor parabólico espelhado, que devolve ao fluxo de ar e à face de saída dos filtros a radiação que iria para a parede. Os soquetes cerâmicos G13 suportam temperatura e UV sem ressecar.',
      specs: [['Refletor', 'Espelhado, perfil y = x²/4f'], ['Distância focal no modelo', '25 mm'], ['Soquete', 'Cerâmico, bipino G13'], ['Passo dos pinos', '12,7 mm']],
      footnote: ''
    },
    baffle: {
      name: 'Filtros baffle chevron',
      note: 'separação inercial · laváveis',
      meta: ['Componente interno', 'Inox AISI 304', 'Cassetes modulares'],
      text: 'Cassetes com palhetas defletoras em chevron (labirinto). O ar muda de direção várias vezes e as gotículas de gordura, mais pesadas, batem nas palhetas e escorrem para a canaleta. Também ajudam a impedir a passagem de chamas para o plenum.',
      specs: [['Princípio', 'Separação inercial'], ['Inclinação no modelo', '≈ 52° (escoamento da gordura)'], ['Cassetes', '5 módulos removíveis'], ['Manutenção', 'Lavagem periódica, conforme o uso']],
      footnote: ''
    },
    canaleta: {
      name: 'Canaleta perimetral de condensados',
      note: 'caimento de 1,5%',
      meta: ['Componente interno', 'Perfil em U', 'Inox AISI 304'],
      text: 'Contorna a borda inferior interna da coifa e recebe a gordura que escorre dos filtros e o condensado das paredes. O caimento de 1,5% leva o líquido até a válvula de dreno, sem acumular.',
      specs: [['Caimento', '1,5 %'], ['Perfil', 'U · 60 × 40 mm'], ['Escoamento', 'Para a válvula de dreno'], ['Material', 'Aço inox AISI 304']],
      footnote: ''
    },
    dreno: {
      name: 'Válvula de dreno 1/2"',
      note: 'esfera · latão / inox',
      meta: ['Ponto mais baixo da canaleta', 'Válvula de esfera', 'Alavanca'],
      text: 'Válvula de esfera de 1/2" no ponto mais baixo da canaleta, para esvaziar e limpar sem desmontar a coifa. O resíduo vai para recipiente e destinação adequada, nunca direto para a rede de esgoto.',
      specs: [['Bitola', '1/2" (Ø 21,3 mm)'], ['Tipo', 'Esfera, passagem plena'], ['Corpo', 'Latão ou inox'], ['Acionamento', '¼ de volta, alavanca']],
      footnote: ''
    },
    comando: {
      name: 'Caixa de comando elétrico IP65',
      note: 'intertravamento UV-C · IP65',
      meta: ['Sobre a coifa', 'Grau de proteção IP65', 'Sinalização por LED'],
      text: 'Concentra a proteção e o comando da bateria UV-C. Liga as lâmpadas apenas com o exaustor em funcionamento (intertravamento) e sinaliza o estado: no modelo, o LED verde acende junto com a luz UV-C.',
      specs: [['Proteção', 'IP65 (poeira e jatos de água)'], ['Função', 'Comando e intertravamento'], ['Entradas', 'Prensa-cabos vedados'], ['Instalação', 'Fora da zona de gordura']],
      footnote: 'O projeto elétrico define proteções, seção dos cabos e alimentação.'
    },
    reatores: {
      name: 'Reatores eletrônicos e conduítes',
      note: 'blindados IP65 · conduíte flexível',
      meta: ['Sobre a coifa', 'Blindados IP65', 'Conduítes flexíveis vedados'],
      text: 'Os reatores eletrônicos alimentam as lâmpadas UV-C e ficam sobre a coifa, fora da zona de gordura. Conduítes flexíveis levam a alimentação até os soquetes no plenum, entrando por prensa-cabos vedados.',
      specs: [['Reatores no modelo', '2 unidades'], ['Proteção', 'IP65'], ['Conduítes', 'Flexíveis, com prensa-cabos'], ['Percurso interno', 'Junto à parede de fundo']],
      footnote: ''
    },
    duto: {
      name: 'Duto de exaustão',
      note: 'velocidade de projeto ≈ 10 m/s',
      meta: ['Sistema completo', 'Uniões estanques', 'Portas de inspeção'],
      text: 'Conduz o ar tratado até a caixa exaustora. O diâmetro é escolhido para uma velocidade próxima de 10 m/s, o que mantém as partículas em suspensão sem elevar demais a perda de carga e o ruído.',
      specs: [['Velocidade de projeto', '≈ 10 m/s'], ['Dimensionamento', 'Ver calculadora'], ['Uniões', 'Flangeadas ou soldadas, estanques'], ['Acesso', 'Portas de inspeção e limpeza']],
      footnote: ''
    },
    exaustor: {
      name: 'Caixa exaustora centrífuga',
      note: 'rotor de pás curvadas para trás',
      meta: ['Sistema completo', 'Ventilador centrífugo', 'Rotor em movimento no modelo'],
      text: 'Ventilador centrífugo que gera a depressão de todo o sistema. No raio-X é possível ver o rotor de pás curvadas para trás girando dentro da voluta.',
      specs: [['Tipo', 'Centrífugo'], ['Potência', 'P = Q · Δp / η (ver calculadora)'], ['Descarga', 'Para o exterior'], ['Instalação', 'Com acesso para manutenção']],
      footnote: ''
    },
    motor: {
      name: 'Motor elétrico',
      note: 'CV / kW pela calculadora',
      meta: ['Sistema completo', 'Acoplado ao exaustor'],
      text: 'Motor que aciona o rotor. A potência sai da vazão e da perda de carga do sistema, com folga sobre a potência de eixo, e é arredondada para o motor comercial imediatamente acima.',
      specs: [['Dimensionamento', 'P = Q · Δp / η + 15 %'], ['Unidades', 'CV e kW'], ['Proteção', 'Conforme projeto elétrico']],
      footnote: ''
    }
  };

  NS.MODELS = {
    1: {
      label: 'Coifa de parede UV-C',
      components: ['carcaca', 'damper', 'pleno', 'uv', 'refletor', 'baffle', 'canaleta', 'dreno', 'comando', 'reatores'],
      specs: [['Material', 'Inox AISI 304 escovado'], ['Filtros', 'Baffle chevron, laváveis'], ['Bateria UV-C', '2 × 254 nm · 2 × 185 nm'], ['Drenagem', 'Canaleta 1,5% · dreno 1/2"']]
    },
    2: {
      label: 'Sistema de exaustão completo',
      components: ['carcaca', 'uv', 'baffle', 'dreno', 'duto', 'exaustor', 'motor'],
      specs: [['Conjunto', 'Coifa + duto + exaustor'], ['Exaustor', 'Centrífugo, pás para trás'], ['Duto', 'Ø para ≈ 10 m/s'], ['Bateria UV-C', 'Na coifa, após os filtros']]
    },
    3: {
      label: 'Coifa central de ilha',
      components: ['carcaca', 'damper', 'uv', 'refletor', 'baffle', 'canaleta', 'dreno', 'comando', 'reatores'],
      specs: [['Material', 'Inox AISI 304 escovado'], ['Filtros', 'Baffle em V, duplos'], ['Captação', '4 faces abertas'], ['Bateria UV-C', '2 fileiras no plenum']]
    }
  };
})();
