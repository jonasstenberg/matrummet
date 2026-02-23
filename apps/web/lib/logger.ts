import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export const logger = pino({
  name: 'web',
  level: process.env.LOG_LEVEL || (isProduction ? 'info' : 'debug'),
  base: {
    service: 'web',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  formatters: {
    level: (label) => ({ level: label }),
  },
  transport: isProduction
    ? undefined
    : { target: 'pino-pretty' },
})
