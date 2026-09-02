const http = require('http');

// Configurações (podem ser sobrescritas por variáveis de ambiente ou argumentos)
const TARGET_HOST = process.env.STRESS_HOST || 'localhost';
const TARGET_PORT = parseInt(process.env.STRESS_PORT || '3000', 10);
const DURATION_SECONDS = parseInt(process.argv[2] || process.env.STRESS_DURATION || '10', 10);
const CONCURRENCY = parseInt(process.argv[3] || process.env.STRESS_CONCURRENCY || '10', 10);

const agent = new http.Agent({
  keepAlive: true,
  maxSockets: 50
});

// Pool balanceado de requisições reais do sistema
const QUERY_POOL = [
  // 1. Estatísticas consolidadas (Cache de contagens)
  '/api/stats',

  // 2. Navegação paginada por categorias (B-Tree composto)
  '/api/tuss?page=1&limit=15&source=tuss-19',
  '/api/tuss?page=2&limit=15&source=tuss-19',
  '/api/tuss?page=1&limit=15&source=tuss-20',
  '/api/tuss?page=1&limit=15&source=tuss-22',
  '/api/tuss?page=1&limit=15&source=tuss-18',
  '/api/tuss?page=1&limit=15&source=all',

  // 3. Busca por código exato (Índice Trigram + B-Tree)
  '/api/tuss?q=30918090',
  '/api/tuss?q=79989985',
  '/api/tuss?q=86000209',

  // 4. Busca textual multitermo com FTS (Full-Text Search com pesos)
  '/api/tuss?q=fresa+tungstenio',
  '/api/tuss?q=protese+quadril',
  '/api/tuss?q=cateter+balao',
  '/api/tuss?q=parafuso+titanio',
  '/api/tuss?q=stent+coronario',

  // 5. Filtros combinados de categoria + texto
  '/api/tuss?source=tuss-20&q=dipirona',
  '/api/tuss?source=tuss-20&q=amoxicilina',
  '/api/tuss?source=tuss-22&q=ablativo',

  // 6. Consultas de alta cardinalidade com candidatos limitados via CTE
  '/api/tuss?q=us',
  '/api/tuss?q=cirurgia',
  '/api/tuss?q=medico'
];

async function runStressTest() {
  console.log('='.repeat(65));
  console.log('🔥 TESTE DE ESTRESSE • SISTEMA TUSS (1.44M REGISTROS)');
  console.log('='.repeat(65));
  console.log(`🎯 Alvo:                   http://${TARGET_HOST}:${TARGET_PORT}`);
  console.log(`👥 Conexões Concorrentes:  ${CONCURRENCY} usuários virtuais simultâneos`);
  console.log(`⏱️  Duração do Teste:       ${DURATION_SECONDS} segundos`);
  console.log(`🎲 Cenários Testados:      ${QUERY_POOL.length} endpoints variados (Cache, FTS e B-Tree)`);
  console.log('-'.repeat(65));
  console.log('🚀 Executando requisições contínuas em paralelo...');

  const latencies = [];
  const statusCounts = {};
  let totalRequests = 0;
  let running = true;

  const startTime = Date.now();
  const stopTime = startTime + DURATION_SECONDS * 1000;

  function executeRequest() {
    if (!running) return;

    const path = QUERY_POOL[Math.floor(Math.random() * QUERY_POOL.length)];
    const reqStart = Date.now();

    const options = {
      hostname: TARGET_HOST,
      port: TARGET_PORT,
      path: path,
      method: 'GET',
      agent: agent,
      timeout: 15000
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const duration = Date.now() - reqStart;
        latencies.push(duration);
        totalRequests++;

        const code = res.statusCode;
        statusCounts[code] = (statusCounts[code] || 0) + 1;

        if (Date.now() < stopTime) {
          setImmediate(executeRequest);
        }
      });
    });

    req.on('error', (err) => {
      const duration = Date.now() - reqStart;
      latencies.push(duration);
      totalRequests++;
      statusCounts[err.code || 'ERR'] = (statusCounts[err.code || 'ERR'] || 0) + 1;

      if (Date.now() < stopTime) {
        setImmediate(executeRequest);
      }
    });

    req.end();
  }

  for (let i = 0; i < CONCURRENCY; i++) {
    executeRequest();
  }

  await new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000));
  running = false;

  await new Promise((resolve) => setTimeout(resolve, 1000));

  const totalTime = (Date.now() - startTime) / 1000;
  latencies.sort((a, b) => a - b);

  const getPercentile = (p) => {
    if (latencies.length === 0) return 0;
    const index = Math.floor((p / 100) * latencies.length);
    return latencies[Math.min(index, latencies.length - 1)];
  };

  const avgLatency =
    latencies.length > 0
      ? (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(1)
      : 0;
  const rps = (totalRequests / totalTime).toFixed(1);

  console.log('\n📊 RESULTADOS OBTIDOS:');
  console.log('='.repeat(65));
  console.log(`✅ Total de Requisições:      ${totalRequests.toLocaleString()}`);
  console.log(`⚡ Vazão Média (Throughput):    ${rps} req/segundo`);
  console.log(`⏱️  Tempo Decorrido:           ${totalTime.toFixed(2)}s`);
  console.log('-'.repeat(65));
  console.log('📈 LATÊNCIAS DE RESPOSTA:');
  console.log(`   ▪ Mínima:                   ${latencies[0] || 0} ms`);
  console.log(`   ▪ Média:                    ${avgLatency} ms`);
  console.log(`   ▪ Mediana (p50):            ${getPercentile(50)} ms`);
  console.log(`   ▪ Percentil 90 (p90):       ${getPercentile(90)} ms`);
  console.log(`   ▪ Percentil 95 (p95):       ${getPercentile(95)} ms`);
  console.log(`   ▪ Percentil 99 (p99):       ${getPercentile(99)} ms`);
  console.log(`   ▪ Máxima:                   ${latencies[latencies.length - 1] || 0} ms`);
  console.log('-'.repeat(65));
  console.log('📋 STATUS DAS RESPOSTAS:');
  for (const [status, count] of Object.entries(statusCounts)) {
    const pct = ((count / totalRequests) * 100).toFixed(1);
    console.log(`   ▪ HTTP ${status}: ${count.toLocaleString()} (${pct}%)`);
  }
  console.log('='.repeat(65));
}

runStressTest().catch(console.error);
