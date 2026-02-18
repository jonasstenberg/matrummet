import { EVENT_BATCH_SIZE } from "./config.js";
import { calculateRetry } from "./retry.js";
import type { DbPool, EventRow } from "./types.js";

export const fetchPendingEvents = async (
  pool: DbPool,
  batchSize: number = EVENT_BATCH_SIZE
): Promise<EventRow[]> => {
  const { rows } = await pool.query<EventRow>(
    `UPDATE events SET status = 'processing'
     WHERE id IN (
       SELECT id FROM events
       WHERE status = 'pending' AND (next_retry_at IS NULL OR next_retry_at <= now())
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     ) RETURNING *`,
    [batchSize]
  );
  return rows;
};

export const markDispatched = async (
  pool: DbPool,
  eventId: string
): Promise<void> => {
  await pool.query(
    `UPDATE events SET status = 'dispatched', processed_at = now() WHERE id = $1`,
    [eventId]
  );
};

export const markFailed = async (
  pool: DbPool,
  eventId: string,
  error: string,
  retryCount: number | null
): Promise<void> => {
  const retry = calculateRetry(retryCount);
  await pool.query(
    `UPDATE events SET status = $2, error_message = $3, retry_count = $4, next_retry_at = $5 WHERE id = $1`,
    [eventId, retry.newStatus, error, retry.retryCount, retry.nextRetryAt]
  );
};

export const getPendingCount = async (pool: DbPool): Promise<number> => {
  const {
    rows: [row],
  } = await pool.query<{ count: string }>(
    `SELECT count(*) FROM events WHERE status = 'pending'`
  );
  return parseInt(row.count || "0", 10);
};
