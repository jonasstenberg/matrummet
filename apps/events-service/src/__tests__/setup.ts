// Mock environment variables for tests
process.env.PORT = "4005";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.MATRIX_HOMESERVER_URL = "https://matrix.test";
process.env.MATRIX_ACCESS_TOKEN = "test-token";
process.env.MATRIX_ROOM_ID = "!test:matrix.test";
process.env.EVENT_BATCH_SIZE = "10";
process.env.EVENT_POLL_INTERVAL_MS = "10000";
