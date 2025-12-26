// Mock environment variables for tests
process.env.PORT = "4004";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.SMTP_FROM = "test@example.com";
process.env.SMTP_HOST = "localhost";
process.env.SMTP_PORT = "1025";
process.env.SMTP_SECURE = "false";
process.env.APP_BASE_URL = "http://localhost:5173";
process.env.EMAIL_RATE_LIMIT = "60";
process.env.EMAIL_BATCH_SIZE = "10";
