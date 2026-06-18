const http = require('http');
const config = require('../lib/config');
const Logger = require('../lib/logger');

const logger = new Logger(config.logLevel);

const users = [];
let nextId = 1;

// ─── Helpers ────────────────────────────────────────────────────────

function send(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString();
      if (!raw) return resolve(null);
      try {
        resolve(JSON.parse(raw));
      } catch (e) {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

// ─── Route handlers ─────────────────────────────────────────────────

const routes = {
  'GET /health': (req, res) => {
    send(res, 200, { status: 'ok', uptime: process.uptime() });
  },

  'GET /users': (req, res) => {
    send(res, 200, users);
  },

  'POST /users': async (req, res) => {
    try {
      const body = await parseBody(req);
      if (!body || !body.name) {
        return send(res, 400, { error: 'Field "name" is required' });
      }
      const user = { id: nextId++, name: body.name };
      users.push(user);
      logger.info(`User created: ${user.name} (#${user.id})`);
      send(res, 201, user);
    } catch (err) {
      send(res, 400, { error: 'Invalid JSON body' });
    }
  },
};

// ─── Router ─────────────────────────────────────────────────────────

function router(req, res) {
  const key = `${req.method} ${req.url}`;
  const handler = routes[key];

  if (!handler) {
    return send(res, 404, { error: `Route ${req.method} ${req.url} not found` });
  }

  const result = handler(req, res);
  if (result && typeof result.catch === 'function') {
    result.catch((err) => {
      logger.error('Unhandled route error:', err.message);
      if (!res.headersSent) {
        send(res, 500, { error: 'Internal server error' });
      }
    });
  }
}

// ─── Server ─────────────────────────────────────────────────────────

const server = http.createServer(router);

server.listen(config.port, config.host, () => {
  logger.info(`Server listening on http://${config.host}:${config.port}`);
});

// ─── Process-level error handling ───────────────────────────────────

process.on('uncaughtException', (err) => {
  logger.error('UNCAUGHT EXCEPTION:', err.message);
  process.exitCode = 1;
});

process.on('unhandledRejection', (reason) => {
  logger.error('UNHANDLED REJECTION:', reason);
  process.exitCode = 1;
});
