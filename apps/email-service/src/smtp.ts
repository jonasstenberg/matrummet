import type { Transporter } from "nodemailer";
import nodemailer from "nodemailer";
import type SMTPTransport from "nodemailer/lib/smtp-transport/index.js";

import { config, smtpPass, smtpUser } from "./config.js";

export type SmtpConfig = {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  connectionTimeout?: number;
  greetingTimeout?: number;
  socketTimeout?: number;
};

export type EmailMessage = {
  from: string;
  to: string;
  subject: string;
  html: string;
  text?: string;
};

export const createSmtpTransport = (
  smtpConfig: SmtpConfig
): Transporter<SMTPTransport.SentMessageInfo> => {
  return nodemailer.createTransport({
    host: smtpConfig.host,
    port: smtpConfig.port,
    secure: smtpConfig.secure,
    connectionTimeout: smtpConfig.connectionTimeout ?? 10000,
    greetingTimeout: smtpConfig.greetingTimeout ?? 10000,
    socketTimeout: smtpConfig.socketTimeout ?? 10000,
    ...(smtpConfig.user && smtpConfig.pass
      ? {
          auth: {
            user: smtpConfig.user,
            pass: smtpConfig.pass,
          },
        }
      : {}),
  });
};

export const getDefaultSmtpConfig = (): SmtpConfig => ({
  host: config.email.host,
  port: config.email.port,
  secure: config.email.secure,
  user: smtpUser,
  pass: smtpPass,
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

export const verifyTransport = async (
  transporter: Transporter<SMTPTransport.SentMessageInfo>
): Promise<boolean> => {
  await transporter.verify();
  return true;
};

export const sendEmail = async (
  transporter: Transporter<SMTPTransport.SentMessageInfo>,
  message: EmailMessage
): Promise<SMTPTransport.SentMessageInfo> => {
  return transporter.sendMail(message);
};

export const createEmailMessage = (
  to: string,
  subject: string,
  html: string,
  text?: string
): EmailMessage => ({
  from: config.email.from,
  to,
  subject,
  html,
  text,
});
