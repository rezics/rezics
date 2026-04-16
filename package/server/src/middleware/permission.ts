import type { RezicsSessionClaims } from "@rezics/contract";
import { Elysia, status } from "elysia";
import { verifyRezicsSessionToken } from "@/session/jwt/jwt.service";
import { prisma } from "#/prisma/client";

export const authMacro = new Elysia({ name: "macro/auth" }).macro(
  "requireLogin",
  {
    async resolve(ctx) {
      const { headers } = ctx as unknown as {
        headers: Record<string, string | undefined>;
      };

      const authorization = headers["authorization"];
      if (!authorization) {
        return status(401, "Unauthorized: No authorization header provided");
      }

      const claims = await verifyRezicsSessionToken(authorization);
      if (!claims) {
        return status(
          401,
          "Unauthorized: Session token is invalid or expired",
        );
      }

      return {
        identity: claims as RezicsSessionClaims,
      };
    },
  },
);

export async function tryResolveIdentity(
  authorization: string | undefined,
): Promise<RezicsSessionClaims | null> {
  if (!authorization) return null;
  return (await verifyRezicsSessionToken(authorization)) as RezicsSessionClaims | null;
}

function isAdminRole(identity: RezicsSessionClaims | null): boolean {
  if (!identity) return false;
  return identity.permission.role === "ADMIN" || identity.permission.role === "ROOT";
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
