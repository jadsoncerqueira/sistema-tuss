/**
 * Construtor inteligente de consultas tsquery para Full-Text Search de Alta Performance
 * @param {string} rawTerm - Termo de busca digitado pelo usuário
 * @returns {string|null} - Expressão tsquery formatada ou null
 */
function buildTsQuery(rawTerm) {
  if (!rawTerm) return null;

  // Remove caracteres especiais que quebram o tsquery
  const sanitized = rawTerm
    .replace(/[^\w\s\u00C0-\u00FF]/gi, ' ')
    .trim();

  if (!sanitized) return null;

  const words = sanitized
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return null;

  // Para termos curtos (ex: "us", "tc", "rx"), busca exata do token para evitar expansão de 300k lexemas
  // Para termos normais (>= 3 letras), usa prefixo :* para suportar plurais e derivações
  const tokens = words.map((w) => {
    if (w.length <= 2) {
      return `${w} | ${w}:*`;
    }
    return `${w}:*`;
  });

  return tokens.join(' & ');
}

module.exports = {
  buildTsQuery,
};
