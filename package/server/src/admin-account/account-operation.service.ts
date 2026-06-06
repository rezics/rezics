import type {
  AdminAuthSessionMutationResponse,
  AdminAuthUserAccountSummary,
  AdminAuthUserAccountSummaryRequest,
  AdminAuthUserSessionsResponse,
  AdminRevokeAuthSessionRequest,
  AdminRevokeAuthUserSessionsRequest,
  AdminStartAuthImpersonationRequest,
  AdminStartAuthImpersonationResponse,
  AuthMainServerReconciliationWarning,
} from "@rezics/contract";
import { and, desc, eq, inArray } from "drizzle-orm";
import {
  listAuthSessionsForAuthUser,
  revokeAuthSessionForAuthUser,
  revokeAuthSessionsForAuthUser,
  startAuthImpersonationSession,
} from "@/auth-boundary/auth-internal.client";
import { env } from "@/env";
import { governanceAuditService } from "@/governance/audit.service";
import { AccountEnforcement, Unit, User } from "../db/schema";

const ENFORCEMENT_STRENGTH = [
  "WARNING",
  "RATE_LIMIT",
  "TRUST_RESTRICTION",
  "SILENCE",
  "SUSPENSION",
  "BAN",
] as const;
const AUTH_SESSION_COOKIE_NAME = "better-auth.session_token";
const DEFAULT_IMPERSONATION_SECONDS = 15 * 60;

type UserAccountSummaryRow = {
  unitId: string;
  authUserId: string | null;
  email: string | null;
  name: string | null;
  permission: unknown;
  unit: { slug: string | null } | null;
  accountEnforcements: Array<{ kind: unknown; expiresAt: Date | null }>;
};

async function getServerDb() {
  const { db } = await import("../db/client");
  return db;
}

async function findUserAccountSummaryRows(
  authUserIds: readonly string[],
): Promise<UserAccountSummaryRow[]> {
  const db = await getServerDb();
  const users = await db
    .select({
      unitId: User.unitId,
      authUserId: User.authUserId,
      email: User.email,
      name: User.name,
      permission: User.permission,
      slug: Unit.slug,
    })
    .from(User)
    .leftJoin(Unit, eq(User.unitId, Unit.id))
    .where(inArray(User.authUserId, authUserIds));

  if (users.length === 0) {
    return [];
  }

  const userIds = users.map((user) => user.unitId);
  const enforcementRows = await db
    .select({
      targetUserId: AccountEnforcement.targetUserId,
      kind: AccountEnforcement.kind,
      expiresAt: AccountEnforcement.expiresAt,
    })
    .from(AccountEnforcement)
    .where(
      and(
        inArray(AccountEnforcement.targetUserId, userIds),
        eq(AccountEnforcement.state, "ACTIVE"),
      ),
    )
    .orderBy(desc(AccountEnforcement.createdAt));

  const enforcementsByUserId = new Map<
    string,
    UserAccountSummaryRow["accountEnforcements"]
  >();
  for (const row of enforcementRows) {
    const list = enforcementsByUserId.get(row.targetUserId) ?? [];
    list.push({ kind: row.kind, expiresAt: row.expiresAt });
    enforcementsByUserId.set(row.targetUserId, list);
  }

  return users.map((user) => ({
    unitId: user.unitId,
    authUserId: user.authUserId,
    email: user.email,
    name: user.name,
    permission: user.permission,
    unit: { slug: user.slug ?? null },
    accountEnforcements: enforcementsByUserId.get(user.unitId) ?? [],
  }));
}

async function findAuthUserIdForMainUser(
  unitId: string,
): Promise<string | null> {
  const db = await getServerDb();
  const [user] = await db
    .select({ authUserId: User.authUserId })
    .from(User)
    .where(eq(User.unitId, unitId))
    .limit(1);
  return user?.authUserId ?? null;
}

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
  user: UserAccountSummaryRow,
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

  const users = await findUserAccountSummaryRows(authUserIds);

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

export function buildAuthImpersonationCookie(input: {
  token: string;
  durationSeconds: number;
}) {
  const secure =
    env.NODE_ENV === "production" ||
    env.AUTH_PUBLIC_ISSUER_URL.startsWith("https://");
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(input.token)}`,
    "Path=/auth",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${input.durationSeconds}`,
  ];
  if (env.NODE_ENV === "production") parts.push("Domain=.rezics.com");
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export async function startAuthUserImpersonation(
  input: AdminStartAuthImpersonationRequest & { actorUserId: string },
): Promise<
  AdminStartAuthImpersonationResponse & { authSessionCookie: string }
> {
  const durationSeconds =
    input.durationSeconds ?? DEFAULT_IMPERSONATION_SECONDS;
  const actorAuthUserId = await findAuthUserIdForMainUser(input.actorUserId);
  if (!actorAuthUserId) {
    throw new Error("Actor has no linked auth user for impersonation.");
  }

  const result = await startAuthImpersonationSession({
    actorAuthUserId,
    targetAuthUserId: input.targetAuthUserId,
    reason: input.reason,
    durationSeconds,
  });
  if (!result.ok || !result.session) {
    throw new Error("Auth impersonation session could not be created.");
  }

  const auditLog = await appendSessionAudit({
    actorUserId: input.actorUserId,
    action: "impersonation.start",
    targetKind: "auth-user",
    targetId: input.targetAuthUserId,
    reason: input.reason,
    metadata: {
      durationSeconds,
      authSessionId: result.session.id,
      actorAuthUserId,
    },
  });

  return {
    success: true,
    targetAuthUserId: input.targetAuthUserId,
    startedAt: result.session.startedAt,
    expiresAt: result.session.expiresAt,
    durationSeconds,
    auditLogId: auditLog.id,
    authSessionCookie: buildAuthImpersonationCookie({
      token: result.session.token,
      durationSeconds,
    }),
  };
}
