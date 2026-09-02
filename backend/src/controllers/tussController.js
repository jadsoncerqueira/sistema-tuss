const TussModel = require('../models/tussModel');
const { buildTsQuery } = require('../services/ftsService');
const { seedDatabase } = require('../services/seedService');
const { optimizeSearch } = require('../services/optimizeService');

class TussController {
  /**
   * GET /api
   * Informações básicas da API
   */
  static async getApiInfo(req, res) {
    res.json({
      message: 'API do Sistema TUSS em execução!',
      environment: process.env.NODE_ENV || 'development',
      architecture: 'MVC (Model-View-Controller)',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * GET /api/health
   * Healthcheck de liveness/readiness
   */
  static async healthCheck(req, res) {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
  }

  /**
   * GET /api/stats
   * Estatísticas consolidadas por categoria TUSS
   */
  static async getStats(req, res, next) {
    try {
      const stats = await TussModel.getStats();
      res.json({
        ...stats,
        status: 'online'
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tuss
   * Busca com FTS, tokenização, ranking e paginação
   */
  static async getProcedures(req, res, next) {
    const startTime = Date.now();
    try {
      const page = Math.max(1, parseInt(req.query.page, 10) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 15));
      const search = (req.query.q || req.query.search || '').trim();
      const source = (req.query.source || '').trim();

      const isNumericOnly = /^\d+$/.test(search);
      const tsQueryStr = buildTsQuery(search);

      const { data, total, isCapped } = await TussModel.searchProcedures({
        search,
        source,
        page,
        limit,
        tsQueryStr,
        isNumericOnly
      });

      const executionTimeMs = Date.now() - startTime;

      res.json({
        data,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit) || 1,
          isCapped
        },
        searchMeta: {
          query: search,
          tokenQuery: tsQueryStr,
          executionTimeMs
        }
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/tuss/:codigo
   * Busca procedimento pelo código TUSS
   */
  static async getProcedureByCode(req, res, next) {
    try {
      const { codigo } = req.params;
      const item = await TussModel.getByCode(codigo);

      if (!item) {
        return res.status(404).json({ error: 'Procedimento não encontrado' });
      }

      res.json(item);
    } catch (error) {
      next(error);
    }
  }

  /**
   * ALL /api/seed
   * Ingestão e sincronização incremental
   */
  static async seed(req, res, next) {
    try {
      const force = req.body?.force === true || req.query?.force === 'true';
      const result = await seedDatabase({ force });
      res.json({ message: 'Povoamento executado com sucesso!', ...result });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/optimize
   * Otimização sob demanda e reconstrução de índices GIN
   */
  static async optimize(req, res, next) {
    try {
      const result = await optimizeSearch();
      res.json({ message: 'Banco de dados otimizado com sucesso!', ...result });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = TussController;
