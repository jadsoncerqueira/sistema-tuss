const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@db:5432/tuss_db',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Inicialização das tabelas com suporte a FTS, Trigram, Tokenização e Rastreamento Incremental
async function initDb() {
  const client = await pool.connect();
  try {
    // 1. Habilita extensões pg_trgm e unaccent
    await client.query(`
      CREATE EXTENSION IF NOT EXISTS pg_trgm;
      CREATE EXTENSION IF NOT EXISTS unaccent;
    `);

    // 2. Cria função immutable_unaccent para permitir indexação e triggers
    await client.query(`
      CREATE OR REPLACE FUNCTION immutable_unaccent(text)
        RETURNS text AS
      $$
        SELECT public.unaccent('public.unaccent', $1);
      $$
      LANGUAGE sql IMMUTABLE STRICT;
    `);

    // 3. Criação da tabela principal de procedimentos
    await client.query(`
      CREATE TABLE IF NOT EXISTS tuss_procedures (
        id SERIAL PRIMARY KEY,
        codigo_tuss VARCHAR(50) NOT NULL,
        display_name TEXT NOT NULL,
        source VARCHAR(100) DEFAULT 'tuss',
        inicio_vigencia VARCHAR(50),
        fim_vigencia VARCHAR(50),
        fim_implantacao VARCHAR(50),
        extras JSONB,
        search_vector tsvector,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      ALTER TABLE tuss_procedures ADD COLUMN IF NOT EXISTS extras JSONB;
      ALTER TABLE tuss_procedures ADD COLUMN IF NOT EXISTS search_vector tsvector;

      -- Migração: remove restrição de unicidade antiga apenas no código se existir
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'tuss_procedures_codigo_tuss_key'
        ) THEN
          ALTER TABLE tuss_procedures DROP CONSTRAINT tuss_procedures_codigo_tuss_key;
        END IF;
      END $$;

      -- Tabela de controle de arquivos importados para Seed Incremental
      CREATE TABLE IF NOT EXISTS tuss_imported_files (
        id SERIAL PRIMARY KEY,
        filename VARCHAR(255) UNIQUE NOT NULL,
        file_hash VARCHAR(64) NOT NULL,
        records_count INT DEFAULT 0,
        source VARCHAR(100),
        imported_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );

      -- Trigger de tokenização automática com pesos (A: Código, B: Descrição, C: Metadados extras)
      CREATE OR REPLACE FUNCTION tuss_procedures_search_trigger() RETURNS trigger AS $$
      BEGIN
        NEW.search_vector :=
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(NEW.codigo_tuss, ''))), 'A') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(NEW.display_name, ''))), 'B') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(NEW.extras->>'fabricante', ''))), 'C') ||
          setweight(to_tsvector('portuguese', immutable_unaccent(coalesce(NEW.extras->>'modelo', ''))), 'C');
        RETURN NEW;
      END
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_tuss_search_update ON tuss_procedures;
      CREATE TRIGGER trg_tuss_search_update BEFORE INSERT OR UPDATE
        ON tuss_procedures FOR EACH ROW EXECUTE FUNCTION tuss_procedures_search_trigger();

      -- Índices de altíssima performance
      CREATE UNIQUE INDEX IF NOT EXISTS idx_tuss_codigo_source ON tuss_procedures (codigo_tuss, source);
      CREATE INDEX IF NOT EXISTS idx_tuss_source_id ON tuss_procedures (source, id ASC);
      CREATE INDEX IF NOT EXISTS idx_tuss_source ON tuss_procedures (source);
      CREATE INDEX IF NOT EXISTS idx_tuss_codigo ON tuss_procedures (codigo_tuss);
      CREATE INDEX IF NOT EXISTS idx_tuss_search_vector ON tuss_procedures USING gin(search_vector);
      CREATE INDEX IF NOT EXISTS idx_tuss_trgm_name ON tuss_procedures USING gin(display_name gin_trgm_ops);
      CREATE INDEX IF NOT EXISTS idx_tuss_trgm_code ON tuss_procedures USING gin(codigo_tuss gin_trgm_ops);
    `);

    console.log('✅ [Config] Estrutura do banco, tabelas de controle e índices GIN/Trigram verificados com sucesso.');
  } catch (error) {
    console.error('❌ [Config] Erro ao inicializar tabelas do banco de dados:', error.message);
  } finally {
    client.release();
  }
}

module.exports = {
  query: (text, params) => pool.query(text, params),
  pool,
  initDb,
};
