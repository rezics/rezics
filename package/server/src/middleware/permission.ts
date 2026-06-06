import type { RezicsSessionClaims } from "@rezics/contract";
import { eq } from "drizzle-orm";
import { Elysia, status } from "elysia";
import {
  verifyRezicsProfileSetupToken,
  verifyRezicsSessionToken,
} from "@/session/jwt/jwt.service";
import { User } from "../db/schema";

const SESSION_COOKIE_NAME = "rezics-session-token";
const PROFILE_SETUP_COOKIE_NAME = "rezics-profile-setup-token";

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

export const authMacro = new Elysia({ name: "macro/auth" })
  .macro("requireLogin", {
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
  })
  .macro("requireProfileSetup", {
    async resolve(ctx) {
      const { headers } = ctx as unknown as {
        headers: Record<string, string | undefined>;
      };

      const setupToken =
        readCookie(headers["cookie"], PROFILE_SETUP_COOKIE_NAME) ?? undefined;
      if (!setupToken) {
        return status(401, "Unauthorized: No profile setup token provided");
      }

      const claims = await verifyRezicsProfileSetupToken(setupToken);
      if (!claims) {
        return status(
          401,
          "Unauthorized: Profile setup token is invalid or expired",
        );
      }

      return {
        setupIdentity: claims,
      };
    },
  });

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

// The token `role` is a rejection-only hint: it may deny a request but never
// grant elevated access. Only `unitId` is trusted as identity; any
// admin/elevated check must verify against the database, never the token claim.
function isAdminRole(identity: RezicsSessionClaims | null): boolean {
  if (!identity) return false;
  return (
    identity.permission.role === "ADMIN" || identity.permission.role === "ROOT"
  );
}

export { isAdminRole };

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function getUserPermission(userId: string): Promise<unknown> {
  const db = await getServerDb();
  const [user] = await db
    .select({ permission: User.permission })
    .from(User)
    .where(eq(User.unitId, userId))
    .limit(1);
  return user?.permission;
}

export async function verifyAdminFromDb(userId: string): Promise<boolean> {
  const permission = (await getUserPermission(userId)) as
    | { role?: string[] }
    | null
    | undefined;
  const roles = permission?.role ?? [];
  return roles.includes("ADMIN") || roles.includes("ROOT");
}

export async function verifyRootFromDb(userId: string): Promise<boolean> {
  const permission = (await getUserPermission(userId)) as
    | { role?: string[] }
    | null
    | undefined;
  return permission?.role?.includes("ROOT") ?? false;
}
