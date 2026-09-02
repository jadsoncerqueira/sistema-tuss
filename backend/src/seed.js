/**
 * Re-export para compatibilidade com `npm run seed` e chamadas diretas
 */
const { seedDatabase } = require('./services/seedService');

if (require.main === module) {
  const force = process.argv.includes('--force') || process.argv.includes('-f');
  seedDatabase({ force })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedDatabase };
