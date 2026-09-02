/**
 * Ponto de entrada do Backend MVC
 */
const { startServer, app } = require('./server');

startServer();

module.exports = app;
