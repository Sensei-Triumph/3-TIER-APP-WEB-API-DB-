const pino = require("pino");
const { env, isProduction } = require("./config");

const logger = pino({
  level: env.LOG_LEVEL,
  base: {
    service: "stack-api",
    environment: env.NODE_ENV,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  transport: isProduction
    ? undefined
    : {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          ignore: "pid,hostname",
        },
      },
});

module.exports = logger;
