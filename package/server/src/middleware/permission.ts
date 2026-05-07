import type { RezicsSessionClaims } from "@rezics/contract";
import { Elysia, status } from "elysia";
import { prisma } from "#/prisma/client";
import { verifyRezicsSessionToken } from "@/session/jwt/jwt.service";

const SESSION_COOKIE_NAME = "rezics-session-token";

function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = part.trim().split("=");
    if (rawKey === name) {
      return decodeURIComponent(rawValue.join("="));
    }
  }

  return null;
}

function resolveSessionToken(
  authorization: string | undefined,
  cookieHeader: string | undefined,
): string | undefined {
  return (
    authorization ?? readCookie(cookieHeader, SESSION_COOKIE_NAME) ?? undefined
  );
}

export const authMacro = new Elysia({ name: "macro/auth" }).macro(
  "requireLogin",
  {
    async resolve(ctx) {
      const { headers } = ctx as unknown as {
        headers: Record<string, string | undefined>;
      };

      const authorization = headers["authorization"];
      const sessionToken = resolveSessionToken(
        authorization,
        headers["cookie"],
      );
      if (!sessionToken) {
        return status(401, "Unauthorized: No session token provided");
      }

      const claims = await verifyRezicsSessionToken(sessionToken);
      if (!claims) {
        return status(401, "Unauthorized: Session token is invalid or expired");
      }

      return {
        identity: claims as RezicsSessionClaims,
      };
    },
  },
);

export async function tryResolveIdentity(
  authorization: string | undefined,
  cookieHeader?: string,
): Promise<RezicsSessionClaims | null> {
  const sessionToken = resolveSessionToken(authorization, cookieHeader);
  if (!sessionToken) return null;
  return (await verifyRezicsSessionToken(
    sessionToken,
  )) as RezicsSessionClaims | null;
}

function isAdminRole(identity: RezicsSessionClaims | null): boolean {
  if (!identity) return false;
  return (
    identity.permission.role === "ADMIN" || identity.permission.role === "ROOT"
  );
}

export { isAdminRole };

export async function verifyAdminFromDb(unitId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { unitId },
    select: { permission: true },
  });
  if (!user) return false;
  const permission = user.permission as { role?: string[] } | null | undefined;
  const roles = permission?.role ?? [];
  return roles.includes("ADMIN") || roles.includes("ROOT");
}

export async function verifyRootFromDb(unitId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { unitId },
    select: { permission: true },
  });
  if (!user) return false;
  const permission = user.permission as { role?: string[] } | null | undefined;
  return permission?.role?.includes("ROOT") ?? false;
}
