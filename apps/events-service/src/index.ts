import { createLogger, getOptionalEnv } from "@matrummet/shared";
import express from "express";
import pg, { Notification, PoolClient } from "pg";

import { config, EVENT_POLL_INTERVAL_MS } from "./config.js";
import { dispatchEvent } from "./dispatcher.js";
import { isMatrixConfigured } from "./matrix.js";
import { fetchPendingEvents, getPendingCount, markDispatched, markFailed } from "./queue.js";

const logger = createLogger({ service: "events-service" });

const pool = new pg.Pool({
  connectionString: config.db.url,
  application_name: "events-service",
});

const processEvents = async (): Promise<void> => {
  const events = await fetchPendingEvents(pool);

  for (const event of events) {
    try {
      await dispatchEvent(event);
      await markDispatched(pool, event.id);
      logger.info(
        { eventId: event.id, eventType: event.event_type },
        "Event dispatched"
      );
    } catch (error) {
      await markFailed(pool, event.id, String(error), event.retry_count);
      logger.error(
        { eventId: event.id, err: error },
        "Error dispatching event"
      );
    }
  }
};

let processingEvents = false;

const processQueue = async (): Promise<void> => {
  if (processingEvents) {
    logger.debug("Event processing already running, skipping");
    return;
  }
  processingEvents = true;
  try {
    await processEvents();
  } catch (error) {
    logger.error({ err: error }, "Error processing event queue");
  } finally {
    processingEvents = false;
  }
};

const logInitialQueueState = async () => {
  const count = await getPendingCount(pool);
  logger.info({ pending: count }, "Initial queue state");
};

const connect = async () => {
  try {
    const notificationClient = await pool.connect();

    pool.on("connect", (client: PoolClient) => {
      void client
        .query(`SET ROLE ${config.db.role}`)
        .then(() =>
          client.query(`SET search_path = ${config.db.schema}, public`)
        )
        .catch((err) =>
          logger.error({ err }, "Error setting up client connection")
        );
    });

    await notificationClient.query(`SET ROLE ${config.db.role}`);
    await notificationClient.query(
      `SET search_path = ${config.db.schema},public`
    );

    await notificationClient.query(`LISTEN ${config.db.channel}`);

    if (!isMatrixConfigured(config.matrix)) {
      logger.warn("Matrix not configured — events will be logged only");
    }

    await logInitialQueueState();

    const seenNotifications = new Set<string>();

    notificationClient.on("notification", (msg: Notification) => {
      if (!msg.payload) return;

      void (async () => {
        try {
          const payload = JSON.parse(msg.payload ?? "") as { id: string };
          const id = payload.id;

          if (seenNotifications.has(id)) return;
          seenNotifications.add(id);
          if (seenNotifications.size > 1000) {
            const first = seenNotifications.values().next().value;
            if (first) {
              seenNotifications.delete(first);
            }
          }
          logger.debug({ payload }, "Received notification");

          await processQueue();
        } catch (error) {
          logger.error({ err: error }, "Error processing notification");
        }
      })();
    });

    setInterval(() => {
      void processQueue().catch((err) => {
        logger.error({ err }, "Error in scheduled event processing.");
      });
    }, EVENT_POLL_INTERVAL_MS);

    logger.info("Events service ready and listening for notifications");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to connect");
    process.exit(1);
  }
};

const app = express();
app.get("/health", (_req, res) => {
  res.sendStatus(200);
});
const port = parseInt(getOptionalEnv("PORT", "4005"), 10);
app.listen(port, () => logger.info({ port }, "Health server started"));

connect();

process.on("SIGINT", () => {
  logger.info("Shutting down");

  void (async () => {
    try {
      await pool.end();
      logger.info("Database connections closed");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Error during shutdown");
      process.exit(1);
    }
  })();
});
