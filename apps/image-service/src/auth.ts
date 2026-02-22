import { verifyToken, type JwtPayload } from "@matrummet/shared";
import { config } from "./config.js";

/**
 * Extract and verify auth from request.
 * Checks in order: Authorization Bearer JWT, auth-token cookie, x-api-key header.
 * x-api-key is validated against PostgREST's validate_api_key() function.
 */
export async function authenticateRequest(
  request: Request,
): Promise<JwtPayload> {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Try auth-token cookie
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth-token=([^;]+)/);
    if (match) {
      return verifyToken(match[1]);
    }
  }

  // Try x-api-key header (validated via PostgREST)
  const apiKey = request.headers.get("x-api-key");
  if (apiKey) {
    const response = await fetch(
      `${config.postgrestUrl}/rpc/current_user_info`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
      },
    );

    if (response.ok) {
      const data = (await response.json()) as { email?: string };
      if (data.email) {
        return { role: "authenticated", email: data.email };
      }
    }

    throw new Error("Invalid API key");
  }

  throw new Error("No authentication token provided");
}

/**
 * Authenticate and require service role.
 * Only service-to-service tokens (minted by the web app) are accepted
 * for destructive operations (delete).
 */
export async function authenticateServiceRequest(
  request: Request,
): Promise<JwtPayload> {
  const payload = await authenticateRequest(request);
  if (payload.role !== "service") {
    throw new Error("Service token required");
  }
  return payload;
}
