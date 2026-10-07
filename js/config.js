/* Smartech 3.0 — config.js
 * Configuração central do site. Edite aqui, sem mexer no resto do código.
 */
window.SMARTECH_CONFIG = {
  /** WhatsApp oficial (somente dígitos, com DDI e DDD). */
  whatsapp: '5548991809488',
  email: 'contato@smartechcoifas.com',

  /**
   * URL do serviço do consultor técnico (Cloudflare Worker em worker/consultor-worker.js),
   * por exemplo "https://smartech-consultor.SEU-USUARIO.workers.dev".
   * Vazio = o consultor responde pela base técnica local, sem IA.
   * A chave do Gemini fica SOMENTE no Worker (segredo), nunca neste arquivo.
   */
  consultorApi: '',

  /** Tempo máximo de espera por uma resposta da IA (ms). */
  consultorTimeoutMs: 25000
};
