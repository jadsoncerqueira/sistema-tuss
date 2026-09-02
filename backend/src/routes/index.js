const express = require('express');
const router = express.Router();
const tussRoutes = require('./tussRoutes');

// Monta todas as rotas sob o prefixo /api
router.use('/', tussRoutes);

module.exports = router;
