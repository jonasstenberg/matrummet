import { getRequiredEnv, getOptionalEnv } from "@matrummet/shared";

export { MAX_RETRIES } from "./constants.js";

export const config = {
  db: {
    url: getRequiredEnv("DATABASE_URL"),
    schema: getOptionalEnv("DB_SCHEMA", "public"),
    role: getOptionalEnv("DB_ROLE", "events_service"),
    channel: "events_channel",
  },
  matrix: {
    homeserverUrl: getOptionalEnv("MATRIX_HOMESERVER_URL", ""),
    accessToken: getOptionalEnv("MATRIX_ACCESS_TOKEN", ""),
    roomId: getOptionalEnv("MATRIX_ROOM_ID", ""),
  },
} as const;

export const EVENT_BATCH_SIZE = Number(
  getOptionalEnv("EVENT_BATCH_SIZE", "10")
);

export const EVENT_POLL_INTERVAL_MS = Number(
  getOptionalEnv("EVENT_POLL_INTERVAL_MS", "10000")
);
