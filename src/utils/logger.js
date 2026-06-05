const logger = {
  log(level, message, meta = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    };
    console.log(JSON.stringify(entry));
  },
  info(message, meta = {}) {
    this.log('INFO', message, meta);
  },
  error(message, meta = {}) {
    this.log('ERROR', message, meta);
  },
  warn(message, meta = {}) {
    this.log('WARN', message, meta);
  },
  debug(message, meta = {}) {
    if (process.env.NODE_ENV !== 'test') {
      this.log('DEBUG', message, meta);
    }
  },
};

module.exports = logger;
