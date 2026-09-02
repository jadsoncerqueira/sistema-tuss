const express = require('express');
const cors = require('cors');
require('dotenv').config();

const routes = require('./routes');
const { notFoundHandler, globalErrorHandler } = require('./middlewares/errorHandler');

const app = express();

// Middlewares Globais
app.use(cors());
app.use(express.json());

// Roteamento
app.use('/api', routes);

// Tratamento de Rotas Inexistentes e Erros Globais
app.use(notFoundHandler);
app.use(globalErrorHandler);

module.exports = app;
