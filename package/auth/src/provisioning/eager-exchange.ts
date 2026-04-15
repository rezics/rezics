import { SignJWT } from "jose";
import { env } from "../env";
import {
  getAuthJwtAudience,
  getAuthJwtIssuer,
  getAuthPrivateSigningKey,
} from "../session/jwt/export";

/**
 * Eagerly provisions a user on the main server by signing a minimal
 * auth-session JWT and sending it to `POST /session/exchange`.
 *
 * This is best-effort: errors are logged and swallowed. The server's
 * exchange endpoint has a self-healing fallback that will provision
 * the user on the next frontend-initiated exchange if this fails.
 */
export async function eagerProvisionViaExchange(
  userId: string,
): Promise<void> {
  try {
    const { kid, alg, key } = await getAuthPrivateSigningKey();

    const token = await new SignJWT({ sub: userId, scope: "user" })
      .setProtectedHeader({ alg, kid })
      .setIssuer(getAuthJwtIssuer())
      .setAudience(getAuthJwtAudience())
      .setIssuedAt()
      .setExpirationTime("60s")
      .sign(key);

    const response = await fetch(
      `${env.SERVER_BASE_URL}/session/exchange`,
      {
        method: "POST",
        headers: {
          "x-auth-session-token": token,
        },
      },
    );

    if (!response.ok) {
      console.error(
        `[eager-exchange] Exchange failed: ${response.status} ${response.statusText}`,
      );
    }
  } catch (error) {
    console.error("[eager-exchange] Failed to provision via exchange:", error);
  }
}
