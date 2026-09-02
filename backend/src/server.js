require('dotenv').config();
const app = require('./app');
const { initDb } = require('./config/db');
const TussModel = require('./models/tussModel');
const { seedDatabase } = require('./services/seedService');

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    // 1. Inicializa extensões e tabelas no banco de dados
    await initDb();

    // 2. Pré-aquece estatísticas e contagens em cache
    const stats = await TussModel.getStats();
    const totalCount = stats.totalProcedures;

    if (totalCount === 0) {
      console.log('🌱 [Server] Banco vazio detectado. Iniciando Auto-Seed de todos os arquivos TUSS em background...');
      seedDatabase().catch((err) => console.error('❌ [Server] Erro no Auto-Seed:', err.message));
    } else {
      console.log(`📊 [Server] Base de dados conectada com ${totalCount.toLocaleString()} registros indexados (Cache pronto).`);
    }

    // 3. Inicializa o servidor HTTP
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`🚀 [Server] Backend MVC rodando na porta ${PORT} [Modo: ${process.env.NODE_ENV || 'development'}]`);
    });

    // Graceful Shutdown para containers Docker
    const gracefulShutdown = async (signal) => {
      console.log(`\n🛑 [Server] Recebido sinal ${signal}. Encerrando conexões com segurança...`);
      server.close(async () => {
        const { pool } = require('./config/db');
        await pool.end();
        console.log('🔌 [Server] Pool de conexões do PostgreSQL encerrado. Processo finalizado.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    return server;
  } catch (error) {
    console.error('❌ [Server] Falha fatal ao iniciar aplicação backend:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  startServer();
}

module.exports = { startServer, app };
