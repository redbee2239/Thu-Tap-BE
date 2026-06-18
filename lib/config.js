const assert = require('assert');

const config = {
  port: parseInt(process.env.PORT, 10) || 3000,
  host: process.env.HOST || '127.0.0.1',
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
};

assert.ok(config.port > 0 && config.port < 65536, `Invalid PORT: ${config.port}`);

module.exports = Object.freeze(config);
