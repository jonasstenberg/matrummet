import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  fetchTemplate,
  markTransactionalSent,
  markTransactionalFailed,
  fetchQueuedTransactionalMessages,
  processTransactionalEmail,
  getQueueCounts,
  type TransactionalMessage,
} from "../queue.js";

// Mock dependencies
vi.mock("../config.js", () => ({
  config: {
    app: {
      baseUrl: "https://app.test.com",
    },
  },
  EMAIL_BATCH_SIZE: 10,
}));

vi.mock("../template.js", () => ({
  renderTemplate: vi.fn((template: string, vars: Record<string, unknown>) => {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
      result = result.replace(`{{${key}}}`, String(value));
    }
    return result;
  }),
}));

vi.mock("../retry.js", () => ({
  calculateTransactionalRetry: vi.fn((retryCount: number | null) => ({
    newStatus: (retryCount ?? 0) >= 2 ? "failed" : "queued",
    retryCount: (retryCount ?? 0) + 1,
    nextRetryAt: new Date("2024-01-01T00:05:00Z"),
  })),
}));

vi.mock("../smtp.js", () => ({
  createEmailMessage: vi.fn(
    (to: string, subject: string, html: string, text?: string) => ({
      from: "noreply@test.com",
      to,
      subject,
      html,
      text,
    })
  ),
  sendEmail: vi.fn().mockResolvedValue({ messageId: "test-id" }),
}));

function createTestLogger() {
  const info = vi.fn();
  return { info };
}

function createTestSendEmailFn() {
  return vi.fn().mockResolvedValue({ messageId: "test-id" });
}

function createTestDbPool() {
  const query = vi.fn();
  return { query };
}

describe("queue", () => {
  let mockPool: ReturnType<typeof createTestDbPool>;
  let mockLogger: ReturnType<typeof createTestLogger>;
  let mockSendEmail: ReturnType<typeof createTestSendEmailFn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockPool = createTestDbPool();
    mockLogger = createTestLogger();
    mockSendEmail = createTestSendEmailFn();
  });

  describe("fetchTemplate", () => {
    it("should return template when found", async () => {
      const template = {
        id: "tmpl-1",
        subject: "Test Subject",
        html_body: "<p>Body</p>",
        text_body: "Body",
        name: "test_template",
      };
      mockPool.query.mockResolvedValueOnce({ rows: [template] });

      const result = await fetchTemplate(mockPool, "tmpl-1");

      expect(result).toEqual(template);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("SELECT * FROM email_templates"),
        ["tmpl-1"]
      );
    });

    it("should return undefined when not found", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      const result = await fetchTemplate(mockPool, "nonexistent");

      expect(result).toBeUndefined();
    });
  });

  describe("markTransactionalSent", () => {
    it("should update message status to sent", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await markTransactionalSent(mockPool, "msg-123");

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE email_messages SET status = 'sent'"),
        ["msg-123"]
      );
    });
  });

  describe("markTransactionalFailed", () => {
    it("should update message with retry info", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await markTransactionalFailed(mockPool, "msg-123", "SMTP error", 1);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE email_messages SET status"),
        ["msg-123", "queued", "SMTP error", 2, expect.any(Date)]
      );
    });
  });

  describe("fetchQueuedTransactionalMessages", () => {
    it("should fetch and lock queued messages", async () => {
      const messages = [
        {
          id: "msg-1",
          template_id: "tmpl-1",
          variables: {},
          recipient_email: "user@example.com",
          metadata: null,
          retry_count: null,
        },
      ];
      mockPool.query.mockResolvedValueOnce({ rows: messages });

      const result = await fetchQueuedTransactionalMessages(mockPool, 5);

      expect(result).toEqual(messages);
      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE email_messages SET status = 'processing'"),
        [5]
      );
    });

    it("should use default batch size when not provided", async () => {
      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await fetchQueuedTransactionalMessages(mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });
  });

  describe("processTransactionalEmail", () => {
    it("should process and send transactional email", async () => {
      const message: TransactionalMessage = {
        id: "msg-1",
        template_id: "tmpl-1",
        variables: { name: "John" },
        recipient_email: "john@example.com",
        metadata: null,
        retry_count: null,
      };

      const template = {
        id: "tmpl-1",
        subject: "Hello {{name}}",
        html_body: "<p>Hi {{name}}</p>",
        text_body: "Hi {{name}}",
        name: "welcome_email",
      };

      mockPool.query
        .mockResolvedValueOnce({ rows: [template] }) // fetchTemplate
        .mockResolvedValueOnce({ rows: [] }); // markTransactionalSent

      await processTransactionalEmail(
        mockPool,
        mockSendEmail,
        message,
        mockLogger
      );

      expect(mockSendEmail).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({ to: "john@example.com" }),
        "Sent transactional email"
      );
    });

    it("should throw when template not found", async () => {
      const message: TransactionalMessage = {
        id: "msg-1",
        template_id: "nonexistent",
        variables: {},
        recipient_email: "test@example.com",
        metadata: null,
        retry_count: null,
      };

      mockPool.query.mockResolvedValueOnce({ rows: [] });

      await expect(
        processTransactionalEmail(
          mockPool,
          mockSendEmail,
          message,
          mockLogger
        )
      ).rejects.toThrow("Template not found: nonexistent");
    });
  });

  describe("getQueueCounts", () => {
    it("should return queue counts", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ transactional: "5", batch: "0" }],
      });

      const result = await getQueueCounts(mockPool);

      expect(result).toEqual({ transactional: 5, batch: 0 });
    });

    it("should query email_messages table", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{ transactional: "0", batch: "0" }],
      });

      await getQueueCounts(mockPool);

      expect(mockPool.query).toHaveBeenCalledWith(
        expect.stringContaining("email_messages")
      );
    });

    it("should return zeros when no counts found", async () => {
      mockPool.query.mockResolvedValueOnce({
        rows: [{}],
      });

      const result = await getQueueCounts(mockPool);

      expect(result).toEqual({ transactional: 0, batch: 0 });
    });
  });
});
