# Smartech 3.0 — coifas industriais em inox AISI 304 com UV-C

Site institucional da Smartech Coifas. É um site estático (HTML, CSS e JavaScript puro), sem build e sem servidor.
Basta abrir o `index.html`. Precisa de internet para as fontes, o GSAP e o three.js, que vêm de CDN com versão fixa e
verificação SRI.

**No ar:** https://carlosserra-a11y.github.io/smartech-3.0/ · versão anterior: [smartech-2.0](https://github.com/carlosserra-a11y/smartech-2.0)

## O que há de novo na 3.0

- **Raio-X:** o modo Raio-X foi refeito do zero.
  - Os materiais da carcaça já nascem `transparent` com `opacity: 1`, então a troca de modo não recompila shader.
  - Ordem de renderização fixa: carcaça em `renderOrder 10` e sem gravar profundidade no Raio-X; peças internas em
    `renderOrder 1`.
  - Contorno ciano em Fresnel, grade holográfica, linha de varredura e o aviso "RAIO-X: CÂMARA INTERNA VISÍVEL".
- **Anatomia interna completa:**
  - Bateria UV-C com tubos de quartzo de 254 nm e 185 nm, soquetes G13 cerâmicos, refletores parabólicos e luz violeta.
  - Cassetes baffle em chevron.
  - Canaleta perimetral com 1,5% de caimento e registro de dreno de 1/2".
  - Plenum cônico e colarinho com damper borboleta.
  - Caixa de comando IP65, reatores eletrônicos blindados e conduítes.
- **Câmera:**
  - OrbitControls com amortecimento.
  - Vistas com transição suave: Isométrica, Corte frontal, Perfil lateral e Câmara UV.
  - Zoom, reset, giro 360° e tela cheia.
- **Componentes:** hotspots clicáveis. Cada clique enquadra a peça e abre a ficha técnica.
- **Calculadora NBR 14518 em tempo real:**
  - Vazão Q = A × V × 3600.
  - Diâmetro do duto a 10 m/s.
  - Potência do exaustor em CV e kW.
  - Quantidade de lâmpadas UV-C.
  - Relatório enviado ao WhatsApp oficial.
- **Guia de áudio:** narração sobre a física da ozonólise. Usa o arquivo gerado pelo Gemini TTS, se existir; senão,
  usa a voz do navegador.
- **Consultor técnico com IA:** Gemini com Google Search grounding. Sem o Worker configurado, responde pela base
  técnica local.
- **Design system:**
  - Proporção de cores: 60% grafite, 30% aço e 10% dourado/ciano.
  - Fontes: Plus Jakarta Sans e JetBrains Mono, esta para os números.
  - Metadados em texto com "·", sem pílulas.

## Estrutura

```
index.html              página inteira (semântica e acessível)
css/base.css            tokens (paleta, fontes, espaçamentos), reset e tipografia
css/components.css      header, botões, cartões, painéis, formulários e diálogos
css/sections.css        layout de cada seção
css/experience.css      visualizador 3D (HUD, Raio-X, hotspots, ficha), guia de áudio e chat do consultor
js/config.js            WhatsApp, e-mail e URL do consultor; é o único arquivo para configurar
js/boot.js              roda antes da 1ª pintura e prepara os estados das animações
js/ui.js                header, menu, projetos, diálogos e formulário
js/motion.js            animações de rolagem (GSAP + ScrollTrigger)
js/calc-core.js         regras da calculadora (funções puras, testadas)
js/calculator.js        liga a calculadora à página
js/audio-script.js      roteiro do guia de áudio (5 capítulos)
js/audio-guide.js       player: arquivo gerado, voz do navegador ou só texto
js/consultor-core.js    base técnica local e renderização segura das respostas
js/consultor.js         chat do consultor (Worker online, base local como reserva)
js/viewer3d.js          carrega o three.js sob demanda e inicia o 3D
js/3d/                  materiais, peças, componentes (fichas), modelos, visualizador e interface
assets/                 logotipo, favicon, foto dos sócios e assets/audio/ (narração)
worker/                 Cloudflare Worker do consultor (a chave do Gemini fica só lá)
scripts/                gerador da narração (Gemini TTS)
tests/                  testes (calculadora, consultor, áudio)
_headers, robots.txt    segurança/cache e SEO
```

## Como editar

| O que | Onde |
|---|---|
| WhatsApp, e-mail e URL do consultor | `js/config.js` |
| Textos | direto no `index.html` |
| Fichas técnicas dos componentes 3D | `js/3d/components.js` |
| Geometria dos modelos | `js/3d/models.js` e `js/3d/parts.js` |
| Premissas da calculadora | `js/calc-core.js` (velocidades por tipo de carga, rendimento, motores e dutos comerciais) |
| Roteiro da narração | `js/audio-script.js` (gere o áudio de novo depois de editar) |
| Base técnica do consultor (modo local) | `js/consultor-core.js` |
| Foto de um projeto | coloque o arquivo em `assets/cases/` e preencha `data-photo="assets/cases/arquivo.webp"` no cartão |

## Ativar a IA (opcional)

A chave do Gemini **nunca** vai no código do site. Ela fica guardada como segredo no Worker ou só no seu computador.

### Consultor técnico (Gemini + Google Search)

1. Instale o [Node.js](https://nodejs.org) e crie uma chave em https://aistudio.google.com/apikey.
2. Copie `worker/wrangler.toml.example` para `worker/wrangler.toml`. Este arquivo não vai para o Git.
3. Dentro da pasta `worker/`, rode:
   ```bash
   npx wrangler secret put GEMINI_API_KEY
   ```
   Cole a chave quando o comando pedir.
4. Ainda em `worker/`, publique o Worker:
   ```bash
   npx wrangler deploy
   ```
5. Copie a URL publicada (`https://smartech-consultor.<sua-conta>.workers.dev`) para `consultorApi` em `js/config.js`.

O Worker aplica:

- CORS só para as origens de `ALLOWED_ORIGINS`;
- limite de perguntas por IP;
- validação do tamanho da pergunta;
- `Cache-Control: no-store`.

O chat exibe as fontes e as sugestões do Google Search sem alteração, como exigem os termos do grounding, e as
respostas não são guardadas.

### Narração do guia de áudio (Gemini TTS)

```bash
GEMINI_API_KEY=sua-chave node scripts/generate-audio.mjs
```

O script gera `assets/audio/*.wav` e atualiza `assets/audio/manifest.js`. Depois disso, publique esses arquivos.
Sem eles, o guia usa a voz pt-BR do navegador. Para ver as requisições sem chamar a API, use `--dry-run`.

## Testes

```bash
node --test tests/calc-core.test.js tests/consultor.test.js tests/audio.test.js
```

## Publicação

O site está no GitHub Pages: branch `main`, pasta raiz. O arquivo `.nojekyll` faz o Pages servir os arquivos como estão.

O `_headers` (CSP, HSTS, `nosniff` e cache) só é aplicado no Cloudflare Pages e no Netlify; o GitHub Pages o ignora.
Se o consultor usar um domínio próprio em vez de `*.workers.dev`, ajuste o `connect-src` da CSP.

## Antes de divulgar (conteúdo — decisão da empresa)

1. **Projetos e clientes** (Carbone, Giassi, Saudoso, Hotel Majestic):
   - confirme a autorização para usar os nomes;
   - confirme os dados das fichas;
   - de preferência, troque pelos dados reais e pelas fotos das obras.
2. **Calculadora e NBR 14518:** as fórmulas são de pré-dimensionamento. Valide as premissas com o responsável técnico.
   O projeto final precisa de ART.
3. **Fichas técnicas do 3D:** são valores de referência. Confira com as especificações reais de fabricação.
4. **Política de privacidade:** o diálogo no site descreve o funcionamento atual, incluindo o consultor com IA. Revise
   com o jurídico (LGPD).
5. Confirme que o e-mail `contato@smartechcoifas.com` existe.
