import type {
  AdminAuthUserAccountSummary,
  AdminAuthUserAccountSummaryRequest,
  AuthMainServerReconciliationWarning,
} from "@rezics/contract";
import { prisma } from "#/prisma/client";

const ENFORCEMENT_STRENGTH = [
  "WARNING",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
  "SILENCE",
  "SUSPENSION",
  "BAN",
] as const;

function warning(
  input: AuthMainServerReconciliationWarning,
): AuthMainServerReconciliationWarning {
  return input;
}

function strongestKind(kinds: string[]) {
  return [...kinds].sort(
    (a, b) =>
      ENFORCEMENT_STRENGTH.indexOf(b as (typeof ENFORCEMENT_STRENGTH)[number]) -
      ENFORCEMENT_STRENGTH.indexOf(a as (typeof ENFORCEMENT_STRENGTH)[number]),
  )[0];
}

function buildMainUserSummary(
  user: NonNullable<Awaited<ReturnType<typeof prisma.user.findMany>>[number]>,
): NonNullable<AdminAuthUserAccountSummary["mainUser"]> {
  const role = (user.permission as { role?: string[] } | null)?.role;
  const mainUser: NonNullable<AdminAuthUserAccountSummary["mainUser"]> = {
    unitId: user.unitId,
  };

  if (user.unit?.slug) mainUser.slug = user.unit.slug;
  if (user.name) mainUser.name = user.name;
  if (user.email) mainUser.email = user.email;
  if (role) mainUser.role = role;

  return mainUser;
}

export async function getAuthUserAccountSummaries(
  input: AdminAuthUserAccountSummaryRequest,
): Promise<AdminAuthUserAccountSummary[]> {
  const authUserIds = [...new Set(input.authUserIds.filter(Boolean))];
  if (authUserIds.length === 0) return [];

  const users = await prisma.user.findMany({
    where: { authUserId: { in: authUserIds } },
    select: {
      unitId: true,
      authUserId: true,
      email: true,
      name: true,
      permission: true,
      unit: { select: { slug: true } },
      accountEnforcements: {
        where: { state: "ACTIVE" },
        orderBy: { createdAt: "desc" },
        select: {
          kind: true,
          expiresAt: true,
        },
      },
    },
  });

  const userByAuthId = new Map(
    users
      .filter((user) => user.authUserId)
      .map((user) => [user.authUserId as string, user]),
  );

  return authUserIds.map((authUserId) => {
    const user = userByAuthId.get(authUserId);
    const activeKinds =
      user?.accountEnforcements.map((row) => String(row.kind)) ?? [];
    const reconciliationWarnings: AuthMainServerReconciliationWarning[] = [];

    if (!user) {
      reconciliationWarnings.push(
        warning({
          code: "missing-main-profile",
          severity: "warning",
          message: "Auth user has no linked main-server profile.",
          suggestedAction: "Materialize or reconcile the main user profile.",
        }),
      );
    }

    const accountEnforcement: AdminAuthUserAccountSummary["accountEnforcement"] =
      {
        activeCount: activeKinds.length,
        activeKinds,
        expiresAt:
          user?.accountEnforcements[0]?.expiresAt?.toISOString() ?? null,
      };
    const strongest = strongestKind(activeKinds);
    if (strongest) {
      accountEnforcement.strongestKind = strongest;
    }

    const summary: AdminAuthUserAccountSummary = {
      authUserId,
      accountEnforcement,
      reconciliationWarnings,
    };

    if (user) {
      summary.mainUser = buildMainUserSummary(user);
    }

    return summary;
  });
}
