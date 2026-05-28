import type {
  AdminAuthSessionMutationResponse,
  AdminAuthUserAccountSummary,
  AdminAuthUserAccountSummaryRequest,
  AdminAuthUserSessionsResponse,
  AdminRevokeAuthSessionRequest,
  AdminRevokeAuthUserSessionsRequest,
  AuthMainServerReconciliationWarning,
} from "@rezics/contract";
import {
  listAuthSessionsForAuthUser,
  revokeAuthSessionForAuthUser,
  revokeAuthSessionsForAuthUser,
} from "@/auth-boundary/auth-internal.client";
import { governanceAuditService } from "@/governance/audit.service";
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

export async function listAuthUserSessions(input: {
  authUserId: string;
}): Promise<AdminAuthUserSessionsResponse> {
  const result = await listAuthSessionsForAuthUser({
    authUserId: input.authUserId,
  });
  return { sessions: result.sessions };
}

async function appendSessionAudit(input: {
  actorUserId: string;
  action: string;
  targetKind: string;
  targetId: string;
  reason: string;
  metadata?: Record<string, unknown>;
}) {
  return governanceAuditService.appendPrivilegedMutation({
    actorUserId: input.actorUserId,
    action: input.action,
    targetKind: input.targetKind,
    targetId: input.targetId,
    reason: input.reason,
    correlationId: crypto.randomUUID(),
    metadata: input.metadata,
  });
}

export async function revokeAuthUserSession(
  input: AdminRevokeAuthSessionRequest & { actorUserId: string },
): Promise<AdminAuthSessionMutationResponse> {
  const result = await revokeAuthSessionForAuthUser({
    authUserId: input.authUserId,
    sessionId: input.sessionId,
    reason: input.reason,
  });

  let auditLogId: string | undefined;
  if (result.ok && (result.revokedSessions ?? 0) > 0) {
    const auditLog = await appendSessionAudit({
      actorUserId: input.actorUserId,
      action: "session.revoke",
      targetKind: "auth-session",
      targetId: input.sessionId,
      reason: input.reason,
      metadata: { authUserId: input.authUserId },
    });
    auditLogId = auditLog.id;
  }

  return {
    success: result.ok,
    revokedSessions: result.revokedSessions ?? 0,
    ...(auditLogId ? { auditLogId } : {}),
  };
}

export async function revokeAuthUserSessions(
  input: AdminRevokeAuthUserSessionsRequest & { actorUserId: string },
): Promise<AdminAuthSessionMutationResponse> {
  const result = await revokeAuthSessionsForAuthUser({
    authUserId: input.authUserId,
    reason: input.reason,
  });

  let auditLogId: string | undefined;
  if (result.ok) {
    const auditLog = await appendSessionAudit({
      actorUserId: input.actorUserId,
      action: "session.revoke_all",
      targetKind: "auth-user",
      targetId: input.authUserId,
      reason: input.reason,
      metadata: { revokedSessions: result.revokedSessions ?? 0 },
    });
    auditLogId = auditLog.id;
  }

  return {
    success: result.ok,
    revokedSessions: result.revokedSessions ?? 0,
    ...(auditLogId ? { auditLogId } : {}),
  };
}
