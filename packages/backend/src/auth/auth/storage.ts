import { and, desc, eq, gt, inArray, like, lt, or } from "drizzle-orm";
import { db } from "../db/client";
import {
  accounts,
  oauthAccessTokens,
  oauthConsents,
  oauthRefreshTokens,
  sessions,
  users,
  verifications,
} from "../db/schema";

export type AuthUserBasic = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export async function findAuthUserForRegistrationCancel(
  authUserId: string,
): Promise<AuthUserBasic | null> {
  return (
    (
      await db
        .select({
          id: users.id,
          email: users.email,
          emailVerified: users.emailVerified,
        })
        .from(users)
        .where(eq(users.id, authUserId))
        .limit(1)
    )[0] ?? null
  );
}

export async function deleteAuthRegistration(
  user: AuthUserBasic,
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(oauthAccessTokens)
      .where(eq(oauthAccessTokens.userId, user.id));
    await tx
      .delete(oauthRefreshTokens)
      .where(eq(oauthRefreshTokens.userId, user.id));
    await tx.delete(oauthConsents).where(eq(oauthConsents.userId, user.id));
    await tx.delete(sessions).where(eq(sessions.userId, user.id));
    await tx.delete(accounts).where(eq(accounts.userId, user.id));
    await tx
      .delete(verifications)
      .where(
        or(
          eq(verifications.identifier, user.email),
          eq(verifications.identifier, user.id),
          like(verifications.identifier, `%${user.email}%`),
        ),
      );
    await tx.delete(users).where(eq(users.id, user.id));
  });
}

export async function findVerifiedFactsUser(authUserId: string): Promise<{
  id: string;
  email: string;
  emailVerified: boolean;
  updatedAt: Date;
  accounts: Array<{ providerId: string }>;
} | null> {
  const user =
    (
      await db
        .select({
          id: users.id,
          email: users.email,
          emailVerified: users.emailVerified,
          updatedAt: users.updatedAt,
        })
        .from(users)
        .where(eq(users.id, authUserId))
        .limit(1)
    )[0] ?? null;
  if (!user) return null;
  const providerRows = await db
    .select({ providerId: accounts.providerId })
    .from(accounts)
    .where(eq(accounts.userId, user.id));
  return { ...user, accounts: providerRows };
}

export async function findAuthUserId(
  authUserId: string,
): Promise<{ id: string } | null> {
  return (
    (
      await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, authUserId))
        .limit(1)
    )[0] ?? null
  );
}

export async function updateAuthUserName(
  authUserId: string,
  name: string,
): Promise<void> {
  await db
    .update(users)
    .set({ name, updatedAt: new Date() })
    .where(eq(users.id, authUserId));
}

export async function findImpersonationUsers(
  actorAuthUserId: string,
  targetAuthUserId: string,
): Promise<{
  actor: { id: string; role: string } | null;
  target: { id: string; role: string; banned: boolean } | null;
}> {
  const [actor, target] = await Promise.all([
    db
      .select({ id: users.id, role: users.role })
      .from(users)
      .where(eq(users.id, actorAuthUserId))
      .limit(1),
    db
      .select({ id: users.id, role: users.role, banned: users.banned })
      .from(users)
      .where(eq(users.id, targetAuthUserId))
      .limit(1),
  ]);
  return { actor: actor[0] ?? null, target: target[0] ?? null };
}

export async function createImpersonationSession(input: {
  userId: string;
  token: string;
  expiresAt: Date;
  impersonatedBy: string;
}): Promise<{
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
  impersonatedBy: string | null;
  createdAt: Date;
}> {
  const now = new Date();
  const [session] = await db
    .insert(sessions)
    .values({
      userId: input.userId,
      token: input.token,
      expiresAt: input.expiresAt,
      impersonatedBy: input.impersonatedBy,
      updatedAt: now,
    })
    .returning({
      id: sessions.id,
      token: sessions.token,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      impersonatedBy: sessions.impersonatedBy,
      createdAt: sessions.createdAt,
    });
  if (!session) throw new Error("Failed to create impersonation session");
  return session;
}

export async function listActiveAuthSessions(authUserId: string): Promise<
  Array<{
    id: string;
    userId: string;
    expiresAt: Date;
    ipAddress: string | null;
    userAgent: string | null;
    impersonatedBy: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>
> {
  return db
    .select({
      id: sessions.id,
      userId: sessions.userId,
      expiresAt: sessions.expiresAt,
      ipAddress: sessions.ipAddress,
      userAgent: sessions.userAgent,
      impersonatedBy: sessions.impersonatedBy,
      createdAt: sessions.createdAt,
      updatedAt: sessions.updatedAt,
    })
    .from(sessions)
    .where(
      and(eq(sessions.userId, authUserId), gt(sessions.expiresAt, new Date())),
    )
    .orderBy(desc(sessions.createdAt));
}

export async function deleteAuthSessionForUser(
  authUserId: string,
  sessionId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(and(eq(sessions.id, sessionId), eq(sessions.userId, authUserId)))
    .returning({ id: sessions.id });
  return deleted.length;
}

export async function deleteAuthSessionsForUser(
  authUserId: string,
): Promise<number> {
  const deleted = await db
    .delete(sessions)
    .where(eq(sessions.userId, authUserId))
    .returning({ id: sessions.id });
  return deleted.length;
}

export async function findStaleUnverifiedUsers(
  cutoff: Date,
): Promise<Array<{ id: string; email: string }>> {
  return db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(and(eq(users.emailVerified, false), lt(users.createdAt, cutoff)));
}

export async function cleanupStaleRegistrations(input: {
  userIds: string[];
  emails: string[];
}): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .delete(oauthAccessTokens)
      .where(inArray(oauthAccessTokens.userId, input.userIds));
    await tx
      .delete(oauthRefreshTokens)
      .where(inArray(oauthRefreshTokens.userId, input.userIds));
    await tx
      .delete(oauthConsents)
      .where(inArray(oauthConsents.userId, input.userIds));
    await tx.delete(sessions).where(inArray(sessions.userId, input.userIds));
    await tx.delete(accounts).where(inArray(accounts.userId, input.userIds));
    await tx
      .delete(verifications)
      .where(
        or(
          inArray(verifications.identifier, input.userIds),
          inArray(verifications.identifier, input.emails),
          ...input.emails.map((email) =>
            like(verifications.identifier, `%${email}%`),
          ),
        ),
      );
    await tx.delete(users).where(inArray(users.id, input.userIds));
  });
}

export async function listAuthAccountsForUser(
  userId: string,
): Promise<Array<{ providerId: string; password: string | null }>> {
  return db
    .select({ providerId: accounts.providerId, password: accounts.password })
    .from(accounts)
    .where(eq(accounts.userId, userId));
}
