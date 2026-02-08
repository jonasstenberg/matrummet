import jwt, { SignOptions, VerifyOptions } from "jsonwebtoken";
import { getRequiredEnv } from "../config/index.js";

export type JwtPayload = {
  role: string;
  [key: string]:
    | string
    | number
    | boolean
    | undefined
    | null
    | Record<string, unknown>;
};

export type JwtConfig = {
  secret: string;
  expiresIn?: string | number;
};

export function loadJwtConfig(): JwtConfig {
  return {
    secret: getRequiredEnv("JWT_SECRET"),
    expiresIn: process.env.JWT_EXPIRES_IN ?? "1h",
  };
}

export function generateToken(
  payload: JwtPayload,
  options?: SignOptions
): string {
  const config = loadJwtConfig();
  const signOptions: SignOptions = {
    ...options,
    algorithm: "HS256",
  };

  if (config.expiresIn) {
    signOptions.expiresIn = config.expiresIn as unknown as number;
  }

  return jwt.sign(payload, config.secret, signOptions);
}

export function verifyToken(
  token: string,
  options?: VerifyOptions
): JwtPayload {
  const config = loadJwtConfig();
  return jwt.verify(token, config.secret, options) as JwtPayload;
}

export function generateServiceToken(
  serviceName: string,
  expiresIn?: string | number
): string {
  const payload: JwtPayload = {
    role: serviceName,
    service: true,
  };

  const options: SignOptions = {};
  if (expiresIn) {
    options.expiresIn = expiresIn as unknown as number;
  }

  return generateToken(payload, options);
}
