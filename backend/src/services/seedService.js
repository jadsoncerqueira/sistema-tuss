const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool, initDb } = require('../config/db');

// Calcula hash MD5 do arquivo para verificar se foi modificado
function calculateFileHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(fileBuffer).digest('hex');
  } catch (err) {
    return null;
  }
}

// Varredura recursiva filtrando diretórios de sistema/build
function scanDirRecursive(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === 'node_modules' ||
        entry.name === '.git' ||
        entry.name === 'dist' ||
        entry.name === 'build' ||
        entry.name === '.system_generated' ||
        entry.name === 'scratch'
      ) {
        continue;
      }
      scanDirRecursive(fullPath, fileList);
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      if (
        entry.name === 'package.json' ||
        entry.name === 'package-lock.json' ||
        entry.name === 'tsconfig.json'
      ) {
        continue;
      }
      fileList.push({
        filename: entry.name,
        fullPath
      });
    }
  }
  return fileList;
}

function discoverDataFiles() {
  const candidateDirs = [
    path.join(__dirname, '..', 'data'),
    path.join('/app', 'fonte'),
    path.join(process.cwd(), 'fonte'),
    path.join(__dirname, '..', '..', 'fonte'),
    path.join(process.cwd(), 'tuss.json'),
    path.join(__dirname, '..', '..', 'tuss.json'),
  ];

  const foundMap = new Map();

  for (const itemPath of candidateDirs) {
    if (fs.existsSync(itemPath)) {
      const stat = fs.statSync(itemPath);
      if (stat.isDirectory()) {
        const files = scanDirRecursive(itemPath);
        for (const f of files) {
          if (!foundMap.has(f.filename)) {
            foundMap.set(f.filename, f.fullPath);
          }
        }
      } else if (stat.isFile() && itemPath.endsWith('.json')) {
        const filename = path.basename(itemPath);
        if (!foundMap.has(filename)) {
          foundMap.set(filename, itemPath);
        }
      }
    }
  }

  return Array.from(foundMap.entries()).map(([filename, fullPath]) => ({
    filename,
    fullPath
  }));
}

function inferSource(filename, item) {
  if (item && item.source) return item.source;
  const lower = filename.toLowerCase();
  if (lower.includes('cbo') || lower.includes('tuss-24')) return 'tuss-24';
  if (lower.includes('tuss-19') || lower.includes('materiais') || lower.includes('opme')) return 'tuss-19';
  if (lower.includes('tuss-18') || lower.includes('taxas')) return 'tuss-18';
  if (lower.includes('tuss-20') || lower.includes('medicamentos')) return 'tuss-20';
  if (lower.includes('tuss-22') || lower.includes('procedimentos')) return 'tuss-22';
  return 'tuss-22';
}

async function seedDatabase(options = {}) {
  const force = options.force === true;
  console.log(`🚀 [SeedService] Iniciando processo de povoamento... [Modo: ${force ? 'FORÇADO (reprocessa tudo)' : 'INCREMENTAL INTELIGENTE'}]`);
  const startTime = Date.now();

  await initDb();
  const client = await pool.connect();

  try {
    const files = discoverDataFiles();
    console.log(`📁 [SeedService] Total de arquivos identificados: ${files.length}`);

    // Busca tabela de controle de arquivos já importados
    const importedRes = await client.query('SELECT filename, file_hash, records_count FROM tuss_imported_files');
    const importedMap = new Map();
    importedRes.rows.forEach((row) => {
      importedMap.set(row.filename, { hash: row.file_hash, count: row.records_count });
    });

    let totalInsertedAll = 0;
    let skippedFilesCount = 0;
    let processedFilesCount = 0;
    const summary = [];

    for (let fileIdx = 0; fileIdx < files.length; fileIdx++) {
      const { filename, fullPath } = files[fileIdx];
      const fileProgress = `[${fileIdx + 1}/${files.length}]`;
      const currentHash = calculateFileHash(fullPath);

      // Verificação Incremental: Se o arquivo já foi importado com o mesmo hash e não é forçado, pula instantaneamente!
      if (!force && currentHash && importedMap.has(filename)) {
        const existing = importedMap.get(filename);
        if (existing.hash === currentHash) {
          console.log(`⏭️  ${fileProgress} ${filename} já importado anteriormente (${existing.count?.toLocaleString()} registros). Pulando...`);
          skippedFilesCount++;
          continue;
        }
      }

      let items = [];
      try {
        const raw = fs.readFileSync(fullPath, 'utf-8');
        items = JSON.parse(raw);
      } catch (err) {
        console.warn(`⚠️ Não foi possível ler ${filename}: ${err.message}`);
        continue;
      }

      if (!Array.isArray(items) || items.length === 0 || typeof items[0] !== 'object' || (!items[0].id && !items[0].codigo_tuss)) {
        console.log(`ℹ️ Ignorando ${filename} (arquivo não é uma lista de itens TUSS).`);
        continue;
      }

      console.log(`\n📖 ${fileProgress} Processando NOVO/MODIFICADO: ${filename} (${items.length.toLocaleString()} itens)`);
      processedFilesCount++;

      const defaultSource = inferSource(filename, items[0]);
      const BATCH_SIZE = 1000;
      let insertedThisFile = 0;

      await client.query('BEGIN');

      try {
        for (let i = 0; i < items.length; i += BATCH_SIZE) {
          const rawBatch = items.slice(i, i + BATCH_SIZE);

          // Deduplica registros com a mesma chave (codigo_tuss, source) dentro do mesmo lote
          const dedupedBatchMap = new Map();
          for (const it of rawBatch) {
            const code = String(it.id || it.codigo_tuss || '').trim();
            if (!code) continue;
            const src = it.source || defaultSource;
            const key = `${code}__${src}`;
            dedupedBatchMap.set(key, { ...it, id: code, source: src });
          }

          const batch = Array.from(dedupedBatchMap.values());
          if (batch.length === 0) continue;

          const values = [];
          const placeholders = [];

          batch.forEach((item, index) => {
            const offset = index * 7;
            placeholders.push(
              `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7})`
            );

            const sourceVal = item.source || defaultSource;
            const extrasJson = item.extras ? JSON.stringify(item.extras) : null;

            values.push(
              String(item.id || item.codigo_tuss || ''),
              String(item.display_name || item.name || ''),
              sourceVal,
              item.extras?.inicio_vigencia || null,
              item.extras?.fim_vigencia || null,
              item.extras?.fim_implantacao || null,
              extrasJson
            );
          });

          const query = `
            INSERT INTO tuss_procedures (codigo_tuss, display_name, source, inicio_vigencia, fim_vigencia, fim_implantacao, extras)
            VALUES ${placeholders.join(', ')}
            ON CONFLICT (codigo_tuss, source) 
            DO UPDATE SET 
              display_name = EXCLUDED.display_name,
              inicio_vigencia = EXCLUDED.inicio_vigencia,
              fim_vigencia = EXCLUDED.fim_vigencia,
              fim_implantacao = EXCLUDED.fim_implantacao,
              extras = EXCLUDED.extras;
          `;

          await client.query(query, values);
          insertedThisFile += batch.length;
          process.stdout.write(`⏳ Progresso ${filename}: ${insertedThisFile}/${items.length}\r`);
        }

        // Registra o arquivo na tabela de controle
        if (currentHash) {
          await client.query(`
            INSERT INTO tuss_imported_files (filename, file_hash, records_count, source, imported_at)
            VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
            ON CONFLICT (filename) 
            DO UPDATE SET 
              file_hash = EXCLUDED.file_hash,
              records_count = EXCLUDED.records_count,
              source = EXCLUDED.source,
              imported_at = CURRENT_TIMESTAMP;
          `, [filename, currentHash, insertedThisFile, defaultSource]);
        }

        await client.query('COMMIT');
        totalInsertedAll += insertedThisFile;
        summary.push({ file: filename, count: insertedThisFile, source: defaultSource });
        console.log(`\n✅ ${filename}: ${insertedThisFile.toLocaleString()} itens gravados com sucesso.`);
      } catch (fileErr) {
        await client.query('ROLLBACK');
        console.error(`\n❌ Erro ao processar ${filename}:`, fileErr.message);
      }
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n🎉 [SeedService] Povoamento finalizado!`);
    console.log(`📊 Resumo: ${processedFilesCount} arquivos processados (${totalInsertedAll.toLocaleString()} itens), ${skippedFilesCount} arquivos inalterados pulados em ${elapsed}s.`);

    return {
      success: true,
      count: totalInsertedAll,
      processedFiles: processedFilesCount,
      skippedFiles: skippedFilesCount,
      summary,
      elapsedSeconds: elapsed
    };
  } catch (error) {
    console.error('\n❌ Erro geral durante o seed do banco de dados:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { seedDatabase };
