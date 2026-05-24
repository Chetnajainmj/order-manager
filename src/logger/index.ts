import { createLogger, StringifyObjectsHook } from 'vue-logger-plugin'

const logger = createLogger({
  enabled: true,
  beforeHooks: [StringifyObjectsHook]
});

function getStack(error: any) {
  try {
    return error.stack;
  } catch (err) {
    logger.warn("Error stack is not supported");
  }
  return error;
}

export default {
  install(app: any, options: any) {
    app.config.errorHandler = (error: any) => {
      logger.error("Global handler:" + getStack(error));
    }

    logger.apply({
      level: options.level ? options.level : "error"
    })

    logger.install(app);
  },
  debug(...args: any): void {
    logger.debug(...args)
  },
  info(...args: any): void {
    logger.info(...args)
  },
  warn(...args: any): void {
    logger.warn(...args)
  },
  error(...args: any): void {
    logger.error(...args)
  },
  log(...args: any): void {
    logger.log(...args)
  }
}
