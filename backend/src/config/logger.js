const winston = require('winston');
const path = require('path');

// REQ-LOG-01: full system logging of user actions and error messages.
// Replaces the scattered console.log/console.error calls across the
// codebase (which is also where the DB password leaked once — see
// CONTRIBUTING.md). Levels: error / warn / info / debug.

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'bcd-backend' },
  transports: [
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/error.log'),
      level: 'error'
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../../logs/combined.log')
    })
  ]
});

// Also log to the console outside of tests, in a human-readable format.
if (process.env.NODE_ENV !== 'test') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Fields that must never reach the logs, even if a caller passes them in
// `meta`. Applies at every logUserAction / error call site.
const SECRET_KEYS = ['password', 'passwordHash', 'password_hash', 'token', 'authorization', 'jwtSecret'];

function redact(meta = {}) {
  const clean = { ...meta };
  for (const key of Object.keys(clean)) {
    if (SECRET_KEYS.includes(key)) {
      clean[key] = '[REDACTED]';
    }
  }
  return clean;
}

// Convenience helper for REQ-LOG-01's "log user actions" requirement
// (login, upload, report download, status change, ...).
function logUserAction(action, meta = {}) {
  logger.info(action, redact(meta));
}

module.exports = logger;
module.exports.logUserAction = logUserAction;
module.exports.redact = redact;
