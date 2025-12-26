import type { EmailMessage } from "./smtp.js";

export interface QueueLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
}

export type SendEmailFn = (message: EmailMessage) => Promise<unknown>;

export interface QueryResult<T> {
  rows: T[];
}

export interface DbPool {
  query: <T>(text: string, values?: unknown[]) => Promise<QueryResult<T>>;
}

import { EMAIL_BATCH_SIZE } from "./config.js";
import { calculateTransactionalRetry } from "./retry.js";
import { renderTemplate } from "./template.js";
import { createEmailMessage } from "./smtp.js";

export type TransactionalMessage = {
  id: string;
  template_id: string;
  variables: Record<string, unknown>;
  recipient_email: string;
  metadata: Record<string, unknown> | null;
  retry_count: number | null;
};

export type EmailTemplate = {
  id: string;
  subject: string;
  html_body: string;
  text_body: string | null;
  name: string;
};

export const fetchTemplate = async (
  pool: DbPool,
  templateId: string
): Promise<EmailTemplate | undefined> => {
  const { rows } = await pool.query<EmailTemplate>(
    `SELECT * FROM email_templates WHERE id = $1`,
    [templateId]
  );
  return rows[0];
};

export const markTransactionalSent = async (
  pool: DbPool,
  messageId: string
): Promise<void> => {
  await pool.query(
    `UPDATE email_messages SET status = 'sent', sent_at = now() WHERE id = $1`,
    [messageId]
  );
};

export const markTransactionalFailed = async (
  pool: DbPool,
  messageId: string,
  error: string,
  retryCount: number | null
): Promise<void> => {
  const retry = calculateTransactionalRetry(retryCount);
  await pool.query(
    `UPDATE email_messages SET status = $2, error_message = $3, retry_count = $4, next_retry_at = $5 WHERE id = $1`,
    [messageId, retry.newStatus, error, retry.retryCount, retry.nextRetryAt]
  );
};

export const fetchQueuedTransactionalMessages = async (
  pool: DbPool,
  batchSize: number = EMAIL_BATCH_SIZE
): Promise<TransactionalMessage[]> => {
  const { rows } = await pool.query<TransactionalMessage>(
    `UPDATE email_messages SET status = 'processing'
     WHERE id IN (
       SELECT id FROM email_messages
       WHERE status = 'queued' AND (next_retry_at IS NULL OR next_retry_at <= now())
       FOR UPDATE SKIP LOCKED
       LIMIT $1
     ) RETURNING *`,
    [batchSize]
  );
  return rows;
};

export const processTransactionalEmail = async (
  pool: DbPool,
  sendEmailFn: SendEmailFn,
  message: TransactionalMessage,
  logger: QueueLogger
): Promise<void> => {
  const template = await fetchTemplate(pool, message.template_id);
  if (!template) {
    throw new Error(`Template not found: ${message.template_id}`);
  }

  const subject = renderTemplate(template.subject, message.variables);
  const html = renderTemplate(template.html_body, message.variables);
  const text = template.text_body
    ? renderTemplate(template.text_body, message.variables)
    : undefined;

  const emailMessage = createEmailMessage(message.recipient_email, subject, html, text);
  await sendEmailFn(emailMessage);
  logger.info(
    { to: message.recipient_email, subject, messageId: message.id },
    "Sent transactional email"
  );
  await markTransactionalSent(pool, message.id);
};

export const getQueueCounts = async (
  pool: DbPool
): Promise<{ transactional: number; batch: number }> => {
  const {
    rows: [counts],
  } = await pool.query<{ transactional: string; batch: string }>(`
    SELECT
      (SELECT count(*) FROM email_messages WHERE status = 'queued') AS transactional,
      0 AS batch
  `);
  return {
    transactional: parseInt(counts.transactional || "0", 10),
    batch: parseInt(counts.batch || "0", 10)
  };
};
