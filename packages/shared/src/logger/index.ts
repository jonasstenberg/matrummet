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
    name: service,
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

export const createRequestLogger = (logger: Logger) => {
  return (
    req: { method: string; url: string; headers: Record<string, unknown> },
    res: { statusCode: number },
    responseTime: number
  ) => {
    const requestId = req.headers["x-request-id"] as string | undefined;

    logger.info(
      {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        responseTime: `${responseTime}ms`,
      },
      "request completed"
    );
  };
};

export const requestIdMiddleware = () => {
  return (
    req: { headers: Record<string, string | undefined> },
    res: { setHeader: (name: string, value: string) => void },
    next: () => void
  ) => {
    const requestId = req.headers["x-request-id"] || crypto.randomUUID();
    req.headers["x-request-id"] = requestId;
    res.setHeader("x-request-id", requestId);
    next();
  };
};
