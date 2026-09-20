import { createFixtureSessionContext } from "./native-enrollment-fixture";
import { createFixtureRestrictionDecision } from "./unit-access-fixture";
import assert from "node:assert/strict";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { users } from "@rezics/schema/postgres/identity/auth";
import { unitAccessGrant, unitAccessRestriction } from "@rezics/schema/postgres/access/access";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { post } from "@rezics/schema/postgres/forum/post";
import { accountFavoriteRevision } from "@rezics/schema/postgres/community/favorites";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	ParticipationDenied,
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { eraseOwnAccount } from "../src/services/participation/erasure";
import { saveFavorite, readFavorite } from "../src/services/favorites/service";
import { FavoriteNotFound, FavoriteRevisionConflict } from "../src/services/favorites/errors";
import type { DatabaseTransaction } from "../src/services/database";

/** Two-connection command races on the caller-validated disposable fixture. */
export async function checkFavoriteConcurrency(connectionString: string) {
	const pool = new Pool({ connectionString, max: 3, statement_timeout: 10000 });
	const db = drizzle({ client: pool });
	async function race(
		firstCommand: (tx: DatabaseTransaction) => Promise<unknown>,
		secondCommand: (tx: DatabaseTransaction) => Promise<unknown>,
		outcome: "stale" | "unreadable" | "success",
	) {
		const ready = Promise.withResolvers<number>();
		const release = Promise.withResolvers<void>();
		const started = Promise.withResolvers<number>();
		const first = db.transaction(async (tx) => {
			const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
			await firstCommand(tx);
			ready.resolve(result.rows[0]!.pid);
			await release.promise;
		});
		void first.catch(ready.reject);
		const blockingPid = await ready.promise;
		const second = db.transaction(async (tx) => {
			const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
			started.resolve(result.rows[0]!.pid);
			await secondCommand(tx);
		});
		void second.catch(started.reject);
		const verified =
			outcome === "success"
				? second
				: assert.rejects(second, outcome === "stale" ? FavoriteRevisionConflict : FavoriteNotFound);
		// Attach rejection handling before waiting on PostgreSQL's actual lock graph.
		void verified.catch(() => {});
		try {
			const blockedPid = await started.promise;
			let observed = false;
			for (let attempt = 0; attempt < 200; attempt++) {
				const result = await pool.query<{ blocked: boolean }>(
					"select $2::integer = any(pg_blocking_pids($1)) as blocked",
					[blockedPid, blockingPid],
				);
				if (result.rows[0]?.blocked) {
					observed = true;
					break;
				}
				await setTimeout(10);
			}
			assert.ok(observed, "the competing command waits for the exact protecting transaction");
		} finally {
			release.resolve();
			await first;
			await verified;
		}
	}
	try {
		const { authority, targetId } = await db.transaction(async (tx) => {
			const [account] = await tx
				.insert(users)
				.values({
					name: "Favorite race owner",
					email: `${crypto.randomUUID()}@example.invalid`,
					emailVerified: true,
				})
				.returning();
			assert.ok(account);
			const self = await ensureSelfEntityInTransaction(tx, account);
			const authority: ParticipationAuthority = {
				principal: { kind: "auth", authUserId: account.id },
				actingEntityId: self.id,
				authorizationRevision: self.authorizationRevision,
			};
			const [target] = await tx
				.insert(post)
				.values({
					kind: "post",
					status: "published",
					publishedAt: new Date(),
					visibility: "public",
				})
				.returning({ id: post.id });
			assert.ok(target);
			return { authority, targetId: target.id };
		});
		await race(
			(tx) =>
				saveFavorite(tx, authority, targetId, { expectedRevision: 0, note: "committed winner" }),
			(tx) => saveFavorite(tx, authority, targetId, { expectedRevision: 0, note: "stale loser" }),
			"stale",
		);
		assert.equal(
			(await db.transaction((tx) => readFavorite(tx, authority, targetId))).entry?.note,
			"committed winner",
		);
		const granted = await db.transaction(async (tx) => {
			const [target] = await tx
				.insert(post)
				.values({
					kind: "post",
					status: "published",
					publishedAt: new Date(),
					visibility: "private",
				})
				.returning({ id: post.id });
			assert.ok(target);
			const [grant] = await tx
				.insert(unitAccessGrant)
				.values({
					unitId: target.id,
					subjectKind: "auth",
					authUserId: authority.principal.authUserId,
					permission: "unit.read",
					scope: [],
					grantedByAuthUserId: authority.principal.authUserId,
				})
				.returning({ id: unitAccessGrant.id });
			assert.ok(grant);
			return { targetId: target.id, grantId: grant.id };
		});
		await race(
			(tx) => saveFavorite(tx, authority, granted.targetId, { expectedRevision: 1 }),
			async (tx) => {
				await lockUnitAccessState(tx, [granted.targetId]);
				await tx
					.update(unitAccessGrant)
					.set({ revokedAt: new Date(), revokedByAuthUserId: authority.principal.authUserId })
					.where(eq(unitAccessGrant.id, granted.grantId));
			},
			"success",
		);
		await assert.rejects(
			db.transaction((tx) =>
				saveFavorite(tx, authority, granted.targetId, {
					expectedRevision: 2,
					refreshPreview: true,
				}),
			),
			FavoriteNotFound,
		);
		await race(
			async (tx) => {
				await lockUnitAccessState(tx, [targetId]);
				const decision = await createFixtureRestrictionDecision(tx, {
					authUserId: authority.principal.authUserId,
					selfEntityId: authority.actingEntityId,
					targetId,
				});
				await tx.insert(unitAccessRestriction).values({
					unitId: targetId,
					subjectKind: "auth",
					authUserId: authority.principal.authUserId,
					permission: "unit.read",
					scope: [],
					createdByAuthUserId: authority.principal.authUserId,
					decisionId: decision.id,
				});
			},
			(tx) => saveFavorite(tx, authority, targetId, { expectedRevision: 2, refreshPreview: true }),
			"unreadable",
		);
		await race(
			(tx) =>
				saveFavorite(tx, authority, targetId, { expectedRevision: 2, note: "before closure" }),
			(tx) => runWithParticipationAuthority(authority, async () => eraseOwnAccount(tx, await createFixtureSessionContext(tx, authority.principal.authUserId))),
			"success",
		);
		await assert.rejects(
			db.transaction((tx) => saveFavorite(tx, authority, targetId, { expectedRevision: 3 })),
			ParticipationDenied,
		);
		const history = await db
			.select({ revision: accountFavoriteRevision.revision })
			.from(accountFavoriteRevision)
			.where(eq(accountFavoriteRevision.authUserId, authority.principal.authUserId));
		assert.deepEqual(
			history.map((row) => row.revision).sort(),
			[1, 2, 3],
			"stale/closed writes append no history",
		);
		return {
			races: 4,
			grantRevocationWaitedForPreview: true,
			restrictionDeniedWaitingPreview: true,
			staleWriteRejected: true,
			erasureWaitedForAdmittedSave: true,
			closedAccountRejected: true,
		};
	} finally {
		await pool.end();
	}
}
