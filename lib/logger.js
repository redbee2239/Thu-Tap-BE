const levels = { error: 0, warn: 1, info: 2, debug: 3 };

class Logger {
  constructor(level) {
    this.level = levels[level] ?? levels.info;
  }

  _log(level, levelName, ...args) {
    if (levels[levelName] > this.level) return;
    const ts = new Date().toISOString();
    process[level === 'error' ? 'stderr' : 'stdout'].write(
      `${ts} [${levelName.toUpperCase()}] ${args.join(' ')}\n`
    );
  }

  error(...args) { this._log('error', 'error', ...args); }
  warn(...args)  { this._log('warn', 'warn', ...args); }
  info(...args)  { this._log('info', 'info', ...args); }
  debug(...args) { this._log('debug', 'debug', ...args); }
}

module.exports = Logger;
