import { and, desc, eq, ilike, inArray, isNull, lt, ne, or, sql, type SQL } from "drizzle-orm";

import { grantingPlatformCapabilities } from "../authorization/platform/policy";
import { effectiveAccountState, type AccountStateRecord } from "../auth/account-state";
import { recordAuditEvent } from "../audit";
import { database, type DatabaseExecutor, type DatabaseTransaction } from "../database";
import { exactCount, lowerBoundCount } from "../counts/contract";
import { WorkPolicy } from "../performance/policy";
import {
	platformCapabilityGrant,
	profile,
	sessions,
	userAccountState,
	users,
} from "../database/schema";
import type { UserAccountState, UserAccountStateReason } from "../database/schema/contract-values";
import { InvalidPaginationCursor } from "../pagination/errors";
import {
	PlatformUserManagerRequired,
	SessionNotFound,
	UserAccountStateExpiryInvalid,
	UserAccountStateRevisionConflict,
	UserNotFound,
	UserSelfStatusChangeForbidden,
} from "../api/users/errors";
import { decodePlatformUserCursor, encodePlatformUserCursor } from "../api/platform-users/cursor";

export interface ListPlatformUsersInput {
	readonly cursor?: string;
	readonly limit: number;
	readonly search?: string;
	readonly state?: UserAccountState;
	readonly emailVerified?: boolean;
}

export type ReplaceAccountStateInput =
	| { readonly expectedRevision: number; readonly state: "active" }
	| {
			readonly expectedRevision: number;
			readonly state: "suspended";
			readonly reason: UserAccountStateReason;
			readonly note?: string;
			readonly expiresAt?: Date;
	  }
	| {
			readonly expectedRevision: number;
			readonly state: "closed";
			readonly reason: UserAccountStateReason;
			readonly note?: string;
	  };

const accountIsActive = or(
	isNull(userAccountState.userId),
	eq(userAccountState.state, "active"),
	and(
		eq(userAccountState.state, "suspended"),
		sql`${userAccountState.expiresAt} is not null and ${userAccountState.expiresAt} <= now()`,
	),
);

function statePredicate(state: UserAccountState): SQL {
	if (state === "active") return accountIsActive!;
	if (state === "closed") return eq(userAccountState.state, "closed");
	return and(
		eq(userAccountState.state, "suspended"),
		or(isNull(userAccountState.expiresAt), sql`${userAccountState.expiresAt} > now()`),
	)!;
}

const userSelection = {
	userId: users.id,
	profileId: profile.id,
	name: users.name,
	email: users.email,
	emailVerified: users.emailVerified,
	state: userAccountState.state,
	reason: userAccountState.reason,
	note: userAccountState.note,
	expiresAt: userAccountState.expiresAt,
	revision: userAccountState.revision,
	stateUpdatedAt: userAccountState.updatedAt,
	updatedByProfileId: userAccountState.updatedByProfileId,
	activeSessionCount: sql<number>`(
		select count(*)::integer
		from (
			select 1 from ${sessions}
			where ${sessions.userId} = ${users.id}
				and ${sessions.expiresAt} > now()
			limit ${WorkPolicy.account.maxActiveSessionCountScan}
		) bounded_active_session
	)`,
	createdAt: users.createdAt,
	updatedAt: users.updatedAt,
};

type SelectedUser = {
	readonly userId: string;
	readonly profileId: string | null;
	readonly name: string;
	readonly email: string;
	readonly emailVerified: boolean;
	readonly state: UserAccountState | null;
	readonly reason: UserAccountStateReason | null;
	readonly note: string | null;
	readonly expiresAt: Date | null;
	readonly revision: number | null;
	readonly stateUpdatedAt: Date | null;
	readonly updatedByProfileId: string | null;
	readonly activeSessionCount: number;
	readonly createdAt: Date;
	readonly updatedAt: Date;
};

function presentUser(row: SelectedUser) {
	const accountState = effectiveAccountState(
		row.state
			? {
					state: row.state,
					reason: row.reason,
					note: row.note,
					expiresAt: row.expiresAt,
					revision: row.revision ?? 0,
					updatedAt: row.stateUpdatedAt,
					updatedByProfileId: row.updatedByProfileId,
				}
			: undefined,
	);
	return {
		userId: row.userId,
		profileId: row.profileId,
		name: row.name,
		email: row.email,
		emailVerified: row.emailVerified,
		accountState,
		activeSessionCount:
			row.activeSessionCount < WorkPolicy.account.maxActiveSessionCountScan
				? exactCount(row.activeSessionCount)
				: lowerBoundCount(row.activeSessionCount),
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export async function listPlatformUsers(input: ListPlatformUsersInput) {
	const cursor = input.cursor ? decodePlatformUserCursor(input.cursor) : undefined;
	if (input.cursor && !cursor) throw new InvalidPaginationCursor();
	const predicates: SQL[] = [];
	if (cursor) {
		const createdAt = new Date(cursor.createdAt);
		predicates.push(
			or(
				lt(users.createdAt, createdAt),
				and(eq(users.createdAt, createdAt), lt(users.id, cursor.userId)),
			)!,
		);
	}
	if (input.search) {
		const search = `%${input.search.trim()}%`;
		predicates.push(or(ilike(users.name, search), ilike(users.email, search))!);
	}
	if (input.state) predicates.push(statePredicate(input.state));
	if (input.emailVerified !== undefined)
		predicates.push(eq(users.emailVerified, input.emailVerified));

	const rows = (await database
		.select(userSelection)
		.from(users)
		.leftJoin(profile, eq(profile.authUserId, users.id))
		.leftJoin(userAccountState, eq(userAccountState.userId, users.id))
		.where(predicates.length ? and(...predicates) : undefined)
		.orderBy(desc(users.createdAt), desc(users.id))
		.limit(input.limit + 1)) as SelectedUser[];
	const hasNext = rows.length > input.limit;
	const page = rows.slice(0, input.limit);
	const last = page.at(-1);
	return {
		items: page.map(presentUser),
		nextCursor:
			hasNext && last
				? encodePlatformUserCursor({
						createdAt: last.createdAt.toISOString(),
						userId: last.userId,
					})
				: null,
	};
}

export async function getPlatformUser(userId: string, executor: DatabaseExecutor = database) {
	const [row] = (await executor
		.select(userSelection)
		.from(users)
		.leftJoin(profile, eq(profile.authUserId, users.id))
		.leftJoin(userAccountState, eq(userAccountState.userId, users.id))
		.where(eq(users.id, userId))
		.limit(1)) as SelectedUser[];
	if (!row) throw new UserNotFound();
	return presentUser(row);
}

async function ensureManagerContinuity(
	tx: DatabaseTransaction,
	targetProfileId: string | null,
	nextState: UserAccountState,
) {
	if (!targetProfileId || nextState === "active") return;
	const grantingCapabilities = grantingPlatformCapabilities("platform.user.status.update");
	const [targetGrant] = await tx
		.select({ id: platformCapabilityGrant.id })
		.from(platformCapabilityGrant)
		.where(
			and(
				eq(platformCapabilityGrant.profileId, targetProfileId),
				inArray(platformCapabilityGrant.capability, grantingCapabilities),
				isNull(platformCapabilityGrant.revokedAt),
				or(
					isNull(platformCapabilityGrant.expiresAt),
					sql`${platformCapabilityGrant.expiresAt} > now()`,
				),
			),
		)
		.limit(1);
	if (!targetGrant) return;
	const [otherManager] = await tx
		.select({ profileId: platformCapabilityGrant.profileId })
		.from(platformCapabilityGrant)
		.innerJoin(profile, eq(profile.id, platformCapabilityGrant.profileId))
		.leftJoin(userAccountState, eq(userAccountState.userId, profile.authUserId))
		.where(
			and(
				ne(platformCapabilityGrant.profileId, targetProfileId),
				inArray(platformCapabilityGrant.capability, grantingCapabilities),
				isNull(platformCapabilityGrant.revokedAt),
				or(
					isNull(platformCapabilityGrant.expiresAt),
					sql`${platformCapabilityGrant.expiresAt} > now()`,
				),
				accountIsActive,
			),
		)
		.limit(1);
	if (!otherManager) throw new PlatformUserManagerRequired();
}

export async function replacePlatformUserAccountState(input: {
	readonly actorProfileId: string;
	readonly actorUserId: string;
	readonly targetUserId: string;
	readonly command: ReplaceAccountStateInput;
}) {
	return database.transaction(async (tx) => {
		const [target] = await tx
			.select({ userId: users.id, profileId: profile.id })
			.from(users)
			.leftJoin(profile, eq(profile.authUserId, users.id))
			.where(eq(users.id, input.targetUserId))
			.limit(1)
			.for("update");
		if (!target) throw new UserNotFound();
		const [stored] = await tx
			.select({
				state: userAccountState.state,
				reason: userAccountState.reason,
				note: userAccountState.note,
				expiresAt: userAccountState.expiresAt,
				revision: userAccountState.revision,
				updatedAt: userAccountState.updatedAt,
				updatedByProfileId: userAccountState.updatedByProfileId,
			})
			.from(userAccountState)
			.where(eq(userAccountState.userId, input.targetUserId))
			.limit(1)
			.for("update");
		const before = effectiveAccountState(stored as AccountStateRecord | undefined);
		if (before.revision !== input.command.expectedRevision)
			throw new UserAccountStateRevisionConflict();
		if (input.actorUserId === input.targetUserId && input.command.state !== "active")
			throw new UserSelfStatusChangeForbidden();
		if (
			input.command.state === "suspended" &&
			input.command.expiresAt !== undefined &&
			input.command.expiresAt.getTime() <= Date.now()
		)
			throw new UserAccountStateExpiryInvalid();
		await ensureManagerContinuity(tx, target.profileId, input.command.state);

		const now = new Date();
		const reason = input.command.state === "active" ? null : input.command.reason;
		const note = input.command.state === "active" ? null : (input.command.note?.trim() ?? null);
		const expiresAt =
			input.command.state === "suspended" ? (input.command.expiresAt ?? null) : null;
		const revision = before.revision + 1;
		await tx
			.insert(userAccountState)
			.values({
				userId: input.targetUserId,
				state: input.command.state,
				reason,
				note,
				expiresAt,
				updatedByProfileId: input.actorProfileId,
				revision,
				updatedAt: now,
			})
			.onConflictDoUpdate({
				target: userAccountState.userId,
				set: {
					state: input.command.state,
					reason,
					note,
					expiresAt,
					updatedByProfileId: input.actorProfileId,
					revision,
					updatedAt: now,
				},
			});
		if (input.command.state !== "active")
			await tx.delete(sessions).where(eq(sessions.userId, input.targetUserId));
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "platform_user.account_state.replace",
			reasonCode: reason ?? undefined,
			target: { kind: "platform_user", id: input.targetUserId },
			details: {
				before: { state: before.state, revision: before.revision },
				after: {
					state: input.command.state,
					revision,
					expiresAt: expiresAt?.toISOString() ?? null,
				},
				note,
			},
		});
		return {
			state: input.command.state,
			reason,
			note,
			expiresAt,
			revision,
			updatedAt: now,
			updatedByProfileId: input.actorProfileId,
		};
	});
}

export async function listPlatformUserSessions(userId: string, currentSessionId: string) {
	await getPlatformUser(userId);
	const rows = await database
		.select({
			id: sessions.id,
			expiresAt: sessions.expiresAt,
			createdAt: sessions.createdAt,
			updatedAt: sessions.updatedAt,
			ipAddress: sessions.ipAddress,
			userAgent: sessions.userAgent,
		})
		.from(sessions)
		.where(and(eq(sessions.userId, userId), sql`${sessions.expiresAt} > now()`))
		.orderBy(desc(sessions.updatedAt), desc(sessions.id));
	return rows.map((row) => ({ ...row, current: row.id === currentSessionId }));
}

export async function revokePlatformUserSession(input: {
	readonly actorProfileId: string;
	readonly targetUserId: string;
	readonly sessionId: string;
}) {
	return database.transaction(async (tx) => {
		const [revoked] = await tx
			.delete(sessions)
			.where(and(eq(sessions.id, input.sessionId), eq(sessions.userId, input.targetUserId)))
			.returning({ id: sessions.id });
		if (!revoked) throw new SessionNotFound();
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "platform_user.session.revoke",
			target: { kind: "platform_user", id: input.targetUserId },
			details: { sessionId: input.sessionId },
		});
		return { revokedCount: 1 };
	});
}

export async function revokeAllPlatformUserSessions(input: {
	readonly actorProfileId: string;
	readonly targetUserId: string;
}) {
	return database.transaction(async (tx) => {
		const revoked = await tx
			.delete(sessions)
			.where(eq(sessions.userId, input.targetUserId))
			.returning({ id: sessions.id });
		if (revoked.length === 0) await getPlatformUser(input.targetUserId, tx);
		await recordAuditEvent(tx, {
			category: "admin_activity",
			outcome: "succeeded",
			actor: { kind: "profile", profileId: input.actorProfileId },
			authority: { kind: "platform" },
			action: "platform_user.sessions.revoke_all",
			target: { kind: "platform_user", id: input.targetUserId },
			details: { revokedCount: revoked.length },
		});
		return { revokedCount: revoked.length };
	});
}
