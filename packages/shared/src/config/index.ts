import * as dotenv from "dotenv";

dotenv.config();

export type BaseConfig = {
  env: string;
  debug: boolean;
};

export type DbConfig = {
  url: string;
  schema: string;
  role: string;
  channel?: string;
};

export function loadBaseConfig(): BaseConfig {
  return {
    env: process.env.NODE_ENV ?? "development",
    debug: process.env.DEBUG === "true",
  };
}

export function loadDbConfig(): DbConfig {
  const dbConfig: DbConfig = {
    url: process.env.DATABASE_URL ?? "",
    schema: process.env.DB_SCHEMA ?? "private",
    role: process.env.DB_ROLE ?? "web_user",
  };

  if (process.env.DB_NOTIFICATION_CHANNEL) {
    dbConfig.channel = process.env.DB_NOTIFICATION_CHANNEL;
  }

  return dbConfig;
}

export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Environment variable ${name} is required but not set`);
  }
  return value;
}

export function getOptionalEnv(name: string, defaultValue: string): string {
  return process.env[name] ?? defaultValue;
}
