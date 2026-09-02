const express = require('express');
const router = express.Router();
const TussController = require('../controllers/tussController');

// Rotas informativas e de monitoramento
router.get('/', TussController.getApiInfo);
router.get('/health', TussController.healthCheck);
router.get('/stats', TussController.getStats);

// Rotas de consulta de procedimentos TUSS
router.get('/tuss', TussController.getProcedures);
router.get('/tuss/:codigo', TussController.getProcedureByCode);

// Rotas administrativas (Seed e Otimização)
router.all('/seed', TussController.seed);
router.post('/optimize', TussController.optimize);

module.exports = router;
