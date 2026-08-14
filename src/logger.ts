import pino from 'pino';

export const logger = pino({
  redact: {
    paths: [
      'auth',
      'authorization',
      'password',
      'passwordHash',
      'token',
      'accessToken',
      'refreshToken',
      'headers.authorization',
      'headers.cookie',
      'body.auth',
      'body.authorization',
      'body.password',
      'body.passwordHash',
      'body.token',
      'body.accessToken',
      'body.refreshToken',
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.auth',
      'req.body.authorization',
      'req.body.password',
      'req.body.passwordHash',
      'req.body.token',
      'req.body.accessToken',
      'req.body.refreshToken',
      '*.auth',
      '*.authorization',
      '*.password',
      '*.passwordHash',
      '*.token',
      '*.accessToken',
      '*.refreshToken'
    ],
    censor: '[REDACTED]'
  }
});
