import { createLogger, getOptionalEnv } from "@recept/shared";
import express from "express";
import pg, { Notification, PoolClient } from "pg";

import { config, EMAIL_BATCH_SIZE, EMAIL_RATE_LIMIT } from "./config.js";

import {
  fetchQueuedTransactionalMessages,
  getQueueCounts,
  markTransactionalFailed,
  processTransactionalEmail,
} from "./queue.js";
import { calculateBatchDelay } from "./retry.js";
import {
  createSmtpTransport,
  getDefaultSmtpConfig,
  sendEmail,
  verifyTransport,
} from "./smtp.js";
import { registerHelpers } from "./template.js";

const batchDelay = calculateBatchDelay(EMAIL_RATE_LIMIT, EMAIL_BATCH_SIZE);

const logger = createLogger({ service: "email-service" });

const pool = new pg.Pool({
  connectionString: config.db.url,
  application_name: "email-service",
});

const transporter = createSmtpTransport(getDefaultSmtpConfig());

// Create bound sendEmail function for queue processing
const sendEmailFn = (message: Parameters<typeof sendEmail>[1]) =>
  sendEmail(transporter, message);

// Register Handlebars helpers
registerHelpers();

const processEmails = async (): Promise<void> => {
  logger.debug("Fetching queued messages");
  const messages = await fetchQueuedTransactionalMessages(pool);
  logger.info({ count: messages.length }, "Fetched queued messages");

  for (const msg of messages) {
    try {
      await processTransactionalEmail(pool, sendEmailFn, msg, logger);
    } catch (error) {
      await markTransactionalFailed(
        pool,
        msg.id,
        String(error),
        msg.retry_count
      );
    }
  }
};

let processingQueues = false;

const processQueues = async (): Promise<void> => {
  if (processingQueues) {
    logger.debug("Queue processing already running, skipping");
    return;
  }
  processingQueues = true;
  try {
    await processEmails();
  } catch (error) {
    logger.error({ err: error }, "Error processing queues");
  } finally {
    processingQueues = false;
  }
};

const logInitialQueueState = async () => {
  const counts = await getQueueCounts(pool);
  logger.info({ queued: counts.transactional }, "Initial queue state");
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

    for (const channel of config.db.channels) {
      await notificationClient.query(`LISTEN ${channel}`);
    }

    await verifyTransport(transporter);
    logger.info("SMTP connection verified");
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

          await processQueues();
        } catch (error) {
          logger.error({ err: error }, "Error processing notification");
        }
      })();
    });

    logger.info({ batchDelay }, "Starting batch processing interval");
    setInterval(() => {
      logger.info("Batch interval triggered");
      void processQueues().catch((err) => {
        logger.error({ err }, "Error in scheduled queue processing.");
      });
    }, batchDelay);

    logger.info("Email service ready and listening for notifications");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to connect");
    process.exit(1);
  }
};

const app = express();
app.get("/health", (_req, res) => {
  res.sendStatus(200);
});
const port = parseInt(getOptionalEnv("PORT", "4004"), 10);
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
