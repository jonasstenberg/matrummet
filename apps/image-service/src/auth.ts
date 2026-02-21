import { verifyToken, type JwtPayload } from "@matrummet/shared";

/**
 * Extract and verify JWT from request.
 * Checks Authorization: Bearer header first, then auth-token cookie.
 */
export function authenticateRequest(request: Request): JwtPayload {
  // Try Authorization header first
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  // Fall back to auth-token cookie
  const cookieHeader = request.headers.get("cookie");
  if (cookieHeader) {
    const match = cookieHeader.match(/(?:^|;\s*)auth-token=([^;]+)/);
    if (match) {
      return verifyToken(match[1]);
    }
  }

  throw new Error("No authentication token provided");
}
