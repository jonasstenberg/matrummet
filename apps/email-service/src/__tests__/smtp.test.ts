import { describe, it, expect, vi } from "vitest";
import type { Transporter } from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import {
  createSmtpTransport,
  getDefaultSmtpConfig,
  verifyTransport,
  sendEmail,
  createEmailMessage,
  type SmtpConfig,
  type EmailMessage,
} from "../smtp.js";

// Mock nodemailer
vi.mock("nodemailer", () => ({
  default: {
    createTransport: vi.fn(() => ({
      verify: vi.fn().mockResolvedValue(true),
      sendMail: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
    })),
  },
}));

// Mock config
vi.mock("../config.js", () => ({
  config: {
    email: {
      host: "smtp.test.com",
      port: 587,
      secure: false,
      from: "test@example.com",
    },
  },
  smtpUser: "testuser",
  smtpPass: "testpass",
}));

describe("smtp", () => {
  describe("createSmtpTransport", () => {
    it("should create transport with basic config", async () => {
      const nodemailer = await import("nodemailer");
      const config: SmtpConfig = {
        host: "smtp.example.com",
        port: 587,
        secure: false,
      };

      createSmtpTransport(config);

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    });

    it("should create transport with auth when credentials provided", async () => {
      const nodemailer = await import("nodemailer");
      const config: SmtpConfig = {
        host: "smtp.example.com",
        port: 465,
        secure: true,
        user: "user@example.com",
        pass: "password123",
      };

      createSmtpTransport(config);

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 465,
        secure: true,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
        auth: {
          user: "user@example.com",
          pass: "password123",
        },
      });
    });

    it("should use custom timeouts when provided", async () => {
      const nodemailer = await import("nodemailer");
      const config: SmtpConfig = {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        connectionTimeout: 5000,
        greetingTimeout: 3000,
        socketTimeout: 8000,
      };

      createSmtpTransport(config);

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        connectionTimeout: 5000,
        greetingTimeout: 3000,
        socketTimeout: 8000,
      });
    });

    it("should not include auth when only user is provided", async () => {
      const nodemailer = await import("nodemailer");
      const config: SmtpConfig = {
        host: "smtp.example.com",
        port: 587,
        secure: false,
        user: "user@example.com",
      };

      createSmtpTransport(config);

      expect(nodemailer.default.createTransport).toHaveBeenCalledWith({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    });
  });

  describe("getDefaultSmtpConfig", () => {
    it("should return config from environment", () => {
      const config = getDefaultSmtpConfig();

      expect(config).toEqual({
        host: "smtp.test.com",
        port: 587,
        secure: false,
        user: "testuser",
        pass: "testpass",
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 10000,
      });
    });
  });

  describe("verifyTransport", () => {
    it("should call verify on transporter and return true", async () => {
      const mockTransporter = {
        verify: vi.fn().mockResolvedValue(true),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>;

      const result = await verifyTransport(mockTransporter);

      expect(mockTransporter.verify).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it("should throw when verify fails", async () => {
      const mockTransporter = {
        verify: vi.fn().mockRejectedValue(new Error("Connection failed")),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>;

      await expect(verifyTransport(mockTransporter)).rejects.toThrow(
        "Connection failed"
      );
    });
  });

  describe("sendEmail", () => {
    it("should send email through transporter", async () => {
      const mockSentInfo = { messageId: "abc123" };
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue(mockSentInfo),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>;

      const message: EmailMessage = {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test body</p>",
        text: "Test body",
      };

      const result = await sendEmail(mockTransporter, message);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith(message);
      expect(result).toEqual(mockSentInfo);
    });

    it("should send email without text when not provided", async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockResolvedValue({ messageId: "abc123" }),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>;

      const message: EmailMessage = {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test body</p>",
      };

      await sendEmail(mockTransporter, message);

      expect(mockTransporter.sendMail).toHaveBeenCalledWith({
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>Test body</p>",
      });
    });

    it("should throw when sendMail fails", async () => {
      const mockTransporter = {
        sendMail: vi.fn().mockRejectedValue(new Error("SMTP error")),
      } as unknown as Transporter<SMTPTransport.SentMessageInfo>;

      const message: EmailMessage = {
        from: "sender@example.com",
        to: "recipient@example.com",
        subject: "Test",
        html: "<p>Test</p>",
      };

      await expect(sendEmail(mockTransporter, message)).rejects.toThrow(
        "SMTP error"
      );
    });
  });

  describe("createEmailMessage", () => {
    it("should create email message with all fields", () => {
      const message = createEmailMessage(
        "recipient@example.com",
        "Test Subject",
        "<p>HTML body</p>",
        "Text body"
      );

      expect(message).toEqual({
        from: "test@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>HTML body</p>",
        text: "Text body",
      });
    });

    it("should create email message without text", () => {
      const message = createEmailMessage(
        "recipient@example.com",
        "Test Subject",
        "<p>HTML body</p>"
      );

      expect(message).toEqual({
        from: "test@example.com",
        to: "recipient@example.com",
        subject: "Test Subject",
        html: "<p>HTML body</p>",
        text: undefined,
      });
    });
  });
});
