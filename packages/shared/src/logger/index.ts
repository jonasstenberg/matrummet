import pino, { Logger, LoggerOptions } from "pino";

export type { Logger } from "pino";

export type ServiceLoggerOptions = {
  service: string;
  level?: string;
  pretty?: boolean;
};

const isProduction = process.env.NODE_ENV === "production";

export const createLogger = (options: ServiceLoggerOptions): Logger => {
  const { service, level = process.env.LOG_LEVEL || (isProduction ? "info" : "debug"), pretty = !isProduction } = options;

  const pinoOptions: LoggerOptions = {
    level,
    base: {
      service,
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: {
      level: (label) => ({ level: label }),
    },
  };

  if (pretty) {
    pinoOptions.transport = {
      target: "pino-pretty",
    };
  }

  return pino(pinoOptions);
};

