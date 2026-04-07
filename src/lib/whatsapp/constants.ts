export const SUGGESTED_EVENTS = [
  "Confirmacion de reserva",
  "Recordatorio de check-in",
  "Recordatorio de check-out",
  "Comprobante de pago",
  "Confirmacion de cancelacion",
  "Modificacion de reserva",
  "Credenciales Wi-Fi",
  "Respuesta late check-out",
  "Encuesta post-estadia",
  "Encuesta durante estadia",
  "Instrucciones de llegada",
  "Confirmacion de early check-in",
];

// Words that trigger Marketing reclassification
export const BANNED_WORDS = [
  // Spanish
  "descuento", "oferta", "promocion", "exclusivo", "limitado", "gratis",
  "regalo", "especial", "aprovecha", "no te pierdas", "recomendamos",
  "descubre", "mejor precio", "ahorra", "bono", "cupon",
  // English
  "discount", "offer", "promotion", "exclusive", "limited", "free",
  "gift", "special", "hurry", "don't miss", "recommend",
  "discover", "best price", "save", "bonus", "coupon",
  // Portuguese
  "desconto", "oferta", "promocao", "exclusivo", "limitado", "gratuito",
  "presente", "especial", "aproveite", "nao perca", "recomendamos",
  "descubra", "melhor preco", "economize", "bonus", "cupom",
  // Cross-language
  "upgrade", "deal",
];

// Phrases that indicate promotional CTAs
export const BANNED_CTA_PATTERNS = [
  /shop\s*now/i, /compra\s*ahora/i, /compre\s*agora/i,
  /check\s*out\s*our/i, /conoce\s*nuestros/i, /conheca\s*nossos/i,
  /visit\s*our/i, /visita\s*nuestro/i, /visite\s*nosso/i,
  /book\s*now/i, /reserva\s*ahora/i, /reserve\s*agora/i,
  /explore/i, /explora/i,
  /try\s*our/i, /prueba\s*nuestro/i, /experimente/i,
  /sign\s*up/i, /registrate/i, /cadastre/i,
  /subscribe/i, /suscribete/i, /inscreva/i,
  /learn\s*more/i, /conoce\s*mas/i, /saiba\s*mais/i,
];

// Gratitude / subjective patterns
export const SUBJECTIVE_PATTERNS = [
  /gracias?\s*por\s*(elegir|preferir|confiar|hospedarte|visitarnos)/i,
  /thank\s*you\s*for\s*(choosing|staying|visiting|your\s*preference)/i,
  /obrigad[oa]\s*por\s*(escolher|preferir|confiar|hospedar|visitar)/i,
  /esperamos\s*(que|verte)/i, /we\s*hope/i, /esperamos\s*que/i,
  /fue\s*un\s*placer/i, /it\s*was\s*a\s*pleasure/i, /foi\s*um\s*prazer/i,
  /bienvenid[oa]/i, /welcome/i, /bem.?vind[oa]/i,
  /disfrut[aeo]/i, /enjoy/i,
  /estamos\s*felices/i, /we('re|\s*are)\s*(happy|glad|excited|thrilled|delighted)/i,
  /ficamos\s*felizes/i,
];

// Cross-sell detection
export const CROSS_SELL_PATTERNS = [
  /tambien\s*(ofrecemos|tenemos|puedes)/i,
  /we\s*also\s*(offer|have)/i,
  /tambem\s*(oferecemos|temos)/i,
  /te\s*puede\s*interesar/i, /you\s*might\s*(like|enjoy|be\s*interested)/i, /pode\s*te\s*interessar/i,
  /conoce\s*nuestro/i, /check\s*out\s*our/i, /conheca\s*nosso/i,
];

export const META_LANGUAGE_CODES: Record<string, string> = {
  es: "es",
  en: "en_US",
  pt: "pt_BR",
};
