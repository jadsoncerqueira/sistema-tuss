const { pool, initDb } = require('../config/db');

// Otimização da busca: regeneração de vetores FTS em lotes e recriação de índices GIN
async function optimizeSearch() {
  console.log('🚀 [OptimizeService] Iniciando processo de otimização dos índices de busca...');
  const startTime = Date.now();

  await initDb();
  const client = await pool.connect();

  try {
    const countRes = await client.query('SELECT COUNT(*) FROM tuss_procedures');
    const total = parseInt(countRes.rows[0].count, 10);
    console.log(`📊 Total de procedimentos a otimizar: ${total.toLocaleString()}`);

    if (total === 0) {
      console.log('⚠️ Tabela tuss_procedures vazia. Execute o seed primeiro.');
      return { total: 0, elapsed: 0 };
    }

    console.log('⚙️ Atualizando coluna search_vector (tsvector) com pesos A, B e C...');

    // Atualiza em chunks de 50.000 para velocidade máxima
    const CHUNK_SIZE = 50000;
    let processed = 0;

    while (processed < total) {
      const updateQuery = `
        UPDATE tuss_procedures
        SET search_vector = 
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(codigo_tuss, ''))), 'A') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(display_name, ''))), 'B') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(extras->>'fabricante', ''))), 'C') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(extras->>'modelo', ''))), 'C')
        WHERE id IN (
          SELECT id FROM tuss_procedures
          WHERE search_vector IS NULL OR id > $1
          ORDER BY id ASC
          LIMIT $2
        );
      `;

      await client.query(updateQuery, [processed, CHUNK_SIZE]);
      processed += CHUNK_SIZE;
      const pct = Math.min(100, Math.round((processed / total) * 100));
      console.log(`⏳ Progresso da tokenização: ${Math.min(processed, total).toLocaleString()}/${total.toLocaleString()} (${pct}%)`);
    }

    console.log('⚡ Recriando índices GIN para alta performance...');
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_tuss_search_vector ON tuss_procedures USING gin(search_vector);
      CREATE INDEX IF NOT EXISTS idx_tuss_trgm_name ON tuss_procedures USING gin(display_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_tuss_trgm_code ON tuss_procedures USING gin(codigo_tuss gin_trgm_ops);
      ANALYZE tuss_procedures;
    `);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`🎉 Otimização concluída com sucesso em ${elapsed}s!`);

    return { total, elapsedSeconds: elapsed, success: true };
  } catch (error) {
    console.error('❌ Erro durante a otimização de busca:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { optimizeSearch };
