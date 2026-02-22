import pg from "pg";
import type { Logger } from "@matrummet/shared";
import { config } from "./config.js";
import { deleteImageVariants } from "./image-processing.js";

let pool: pg.Pool | null = null;
let client: pg.PoolClient | null = null;

export async function startImageCleanupListener(logger: Logger): Promise<void> {
  if (!config.databaseUrl) {
    logger.warn("DATABASE_URL not set — image cleanup listener disabled");
    return;
  }

  try {
    pool = new pg.Pool({
      connectionString: config.databaseUrl,
      application_name: "image-service",
    });

    client = await pool.connect();
    await client.query("LISTEN image_cleanup");

    client.on("notification", (msg) => {
      const raw = msg.payload;
      if (!raw) return;

      void (async () => {
        try {
          const payload = JSON.parse(raw) as { image_id: string };
          const imageId = payload.image_id;

          if (!imageId) {
            logger.warn({ payload: raw }, "Missing image_id in notification");
            return;
          }

          await deleteImageVariants(imageId);
          logger.info({ imageId }, "Deleted orphaned image variants");
        } catch (error) {
          logger.error({ err: error, payload: raw }, "Error processing image cleanup notification");
        }
      })();
    });

    client.on("error", (err) => {
      logger.fatal({ err }, "Image cleanup listener connection error");
      process.exit(1);
    });

    logger.info("Image cleanup listener started");
  } catch (error) {
    logger.fatal({ err: error }, "Failed to start image cleanup listener");
    process.exit(1);
  }
}

export async function stopImageCleanupListener(): Promise<void> {
  if (client) {
    client.release();
    client = null;
  }
  if (pool) {
    await pool.end();
    pool = null;
  }
}
