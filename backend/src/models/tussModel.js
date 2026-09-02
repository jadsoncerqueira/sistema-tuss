const { query } = require('../config/db');

// Cache em memória para contagens de categorias (evita COUNT(*) de 1.44M em cada clique de aba)
let countCache = {
  timestamp: 0,
  total: 0,
  sources: {}
};

async function getCachedCategoryCounts() {
  const now = Date.now();
  // Retorna cache se tiver menos de 60 segundos e já estiver populado
  if (now - countCache.timestamp < 60000 && countCache.total > 0) {
    return countCache;
  }

  const totalResult = await query('SELECT COUNT(*) FROM tuss_procedures');
  const sourcesResult = await query(`
    SELECT source, COUNT(*) as count 
    FROM tuss_procedures 
    GROUP BY source 
    ORDER BY count DESC
  `);

  countCache.total = parseInt(totalResult.rows[0]?.count || 0, 10);
  countCache.sources = {};
  sourcesResult.rows.forEach((r) => {
    countCache.sources[r.source] = parseInt(r.count, 10);
  });
  countCache.timestamp = now;

  return countCache;
}

class TussModel {
  /**
   * Invalida o cache de contagens (chamado após novos seeds)
   */
  static invalidateCountCache() {
    countCache.timestamp = 0;
  }

  /**
   * Busca paginada de procedimentos com FTS, Trigram, CTE e ranking por relevância
   */
  static async searchProcedures({ search, source, page = 1, limit = 15, tsQueryStr = null, isNumericOnly = false }) {
    const offset = (page - 1) * limit;
    const params = [];

    if (search) {
      // MODO 1: Busca ativa por termo com FTS e Ranking
      const hasSource = source && source !== 'all';
      let paramIdx = 1;

      const rawSearchParam = search;
      params.push(rawSearchParam); // $1 = termo bruto
      const rawParamIdx = paramIdx++;

      let tsParamIdx = null;
      if (tsQueryStr) {
        params.push(tsQueryStr); // $2 = termo tokenizado para FTS GIN
        tsParamIdx = paramIdx++;
      }

      let sourceParamIdx = null;
      if (hasSource) {
        params.push(source);
        sourceParamIdx = paramIdx++;
      }

      const sourceFilter = hasSource ? `AND p.source = $${sourceParamIdx}` : '';

      // Cláusula de correspondência FTS GIN otimizada
      let matchCondition = '';
      if (isNumericOnly) {
        matchCondition = tsParamIdx
          ? `(p.codigo_tuss ILIKE $${rawParamIdx} || '%' OR p.search_vector @@ to_tsquery('portuguese', immutable_unaccent($${tsParamIdx})))`
          : `(p.codigo_tuss ILIKE $${rawParamIdx} || '%')`;
      } else {
        matchCondition = tsParamIdx
          ? `(p.search_vector @@ to_tsquery('portuguese', immutable_unaccent($${tsParamIdx})) OR p.codigo_tuss ILIKE $${rawParamIdx} || '%')`
          : `(p.codigo_tuss ILIKE $${rawParamIdx} || '%')`;
      }

      // Cálculo de relevância com pontuação ponderada
      const rankFormula = `
        (
          CASE 
            WHEN p.codigo_tuss = $${rawParamIdx} THEN 100.0
            WHEN p.codigo_tuss ILIKE $${rawParamIdx} || '%' THEN 50.0
            WHEN p.display_name ILIKE $${rawParamIdx} || '%' THEN 30.0
            ELSE 0.0 
          END
          ${tsParamIdx ? `+ COALESCE(ts_rank(p.search_vector, to_tsquery('portuguese', immutable_unaccent($${tsParamIdx}))), 0.0) * 10.0` : ''}
        )
      `;

      // Contagem limitada a 10.001 para queries de alta cardinalidade
      const countQuery = `
        SELECT count(*) FROM (
          SELECT 1 
          FROM tuss_procedures p 
          WHERE ${matchCondition} ${sourceFilter}
          LIMIT 10001
        ) t
      `;

      const limitParamIdx = paramIdx++;
      params.push(limit);

      const offsetParamIdx = paramIdx++;
      params.push(offset);

      // Query CTE com ordenação e limite de candidatos
      const dataQuery = `
        WITH candidates AS (
          SELECT 
            p.id,
            p.codigo_tuss,
            p.display_name,
            p.source,
            p.inicio_vigencia,
            p.fim_vigencia,
            p.fim_implantacao,
            p.extras,
            p.search_vector
          FROM tuss_procedures p
          WHERE ${matchCondition} ${sourceFilter}
          LIMIT 2000
        )
        SELECT 
          id,
          codigo_tuss,
          display_name,
          source,
          inicio_vigencia,
          fim_vigencia,
          fim_implantacao,
          extras,
          ${rankFormula} AS relevance_score
        FROM candidates p
        ORDER BY relevance_score DESC, p.id ASC
        LIMIT $${limitParamIdx} OFFSET $${offsetParamIdx}
      `;

      const countParams = params.slice(0, params.length - 2);

      const [countRes, dataRes] = await Promise.all([
        query(countQuery, countParams),
        query(dataQuery, params)
      ]);

      let total = parseInt(countRes.rows[0]?.count || 0, 10);
      const isCapped = Boolean(total > 10000);
      if (isCapped) total = 10000;

      return {
        data: dataRes.rows,
        total,
        isCapped
      };
    } else {
      // MODO 2: Navegação instantânea por categorias (sem busca ativa)
      // Utiliza contagem em cache (0ms) e índice composto (source, id) para resposta sub-10ms
      const cached = await getCachedCategoryCounts();
      const hasSource = source && source !== 'all';

      let total = 0;
      let dataQuery = '';

      if (hasSource) {
        total = cached.sources[source] || 0;
        params.push(source, limit, offset);
        dataQuery = `
          SELECT id, codigo_tuss, display_name, source, inicio_vigencia, fim_vigencia, fim_implantacao, extras
          FROM tuss_procedures 
          WHERE source = $1 
          ORDER BY id ASC 
          LIMIT $2 OFFSET $3
        `;
      } else {
        total = cached.total || 0;
        params.push(limit, offset);
        dataQuery = `
          SELECT id, codigo_tuss, display_name, source, inicio_vigencia, fim_vigencia, fim_implantacao, extras
          FROM tuss_procedures 
          ORDER BY id ASC 
          LIMIT $1 OFFSET $2
        `;
      }

      const dataRes = await query(dataQuery, params);

      return {
        data: dataRes.rows,
        total,
        isCapped: false
      };
    }
  }

  /**
   * Busca procedimento pelo código TUSS
   */
  static async getByCode(codigo) {
    const result = await query('SELECT * FROM tuss_procedures WHERE codigo_tuss = $1', [codigo]);
    return result.rows[0] || null;
  }

  /**
   * Retorna estatísticas de contagem agrupadas por fonte
   */
  static async getStats() {
    const cached = await getCachedCategoryCounts();
    return {
      totalProcedures: cached.total,
      sources: Object.entries(cached.sources).map(([src, count]) => ({
        source: src,
        count
      }))
    };
  }

  /**
   * Retorna total de procedimentos
   */
  static async getTotalCount() {
    const res = await query('SELECT COUNT(*) FROM tuss_procedures');
    return parseInt(res.rows[0]?.count || 0, 10);
  }
}

module.exports = TussModel;
