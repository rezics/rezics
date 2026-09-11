import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { database } from "../src/services/database";
import {
	users,
	unitOwnership,
	unitAccessGrant,
	realm,
	realmMember,
	realmRuleRevision,
	realmRuleAcceptance,
	unitFollow,
	authEntity,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import {
	RealmCapabilityRequired,
	RealmRulesAcceptanceRequired,
} from "../src/services/authorization/errors";
import {
	ParticipationDenied,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { RealmNotFound, RealmOwnerLeaveForbidden } from "../src/services/api/realms/errors";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Realm membership requires a disposable loopback target",
);
const observability = initializeObservability({
	service: {
		name: "rezics-realm-membership-qualification",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const context = await auth.$context;
let checks = 0,
	httpChecks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function actor(name: string) {
	const person = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		const participation: ParticipationAuthority = {
			principal: { kind: "auth", authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		return { account, self, authorization: new Authorization(self.id, account.id, participation) };
	});
	const session = await context.internalAdapter.createSession(person.account.id);
	const [cookie] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { ...person, cookie };
}
async function newRealm(values: Partial<typeof realm.$inferInsert> = {}) {
	const [row] = await database
		.insert(realm)
		.values({ status: "published", visibility: "public", publishedAt: new Date(), ...values })
		.returning();
	assert.ok(row);
	return row;
}
async function request(
	method: string,
	path: string,
	expectedStatus: number,
	cookie: string,
	body?: unknown,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/realms/${path}`, {
			method,
			headers: {
				Cookie: cookie,
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 1200)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
const member = await actor("Realm member"),
	other = await actor("Other Realm member");
try {
	const muted = await newRealm();
	await database
		.insert(realmMember)
		.values({ realmId: muted.id, profileId: member.self.id, state: "muted" });
	check(
		(await request("PUT", `${muted.id}/membership`, 200, member.cookie)).state,
		"muted",
		"joining again cannot remove a member's mute",
	);
	await request("DELETE", `${muted.id}/membership`, 204, member.cookie);
	check(
		(
			await database
				.select()
				.from(realmMember)
				.where(and(eq(realmMember.realmId, muted.id), eq(realmMember.profileId, member.self.id)))
		)[0]?.state,
		"muted",
		"leaving retains a mute",
	);
	check(
		(
			await database
				.select()
				.from(unitFollow)
				.where(
					and(eq(unitFollow.unitId, muted.id), eq(unitFollow.followerProfileId, member.self.id)),
				)
		).length,
		0,
		"restricted departure removes the follow",
	);
	check(
		(await request("PUT", `${muted.id}/membership`, 200, member.cookie)).state,
		"muted",
		"leave and rejoin cannot remove a mute",
	);

	const existing = await newRealm({ joinPolicy: "approval" });
	await database
		.insert(realmMember)
		.values({ realmId: existing.id, profileId: member.self.id, state: "active" });
	check(
		(await request("PUT", `${existing.id}/membership`, 200, member.cookie)).state,
		"active",
		"joining again does not demote an accepted member to pending",
	);
	const open = await newRealm();
	check(
		(await request("PUT", `${open.id}/membership`, 200, member.cookie)).state,
		"active",
		"open Realm admission is active",
	);
	check(
		(await request("PUT", `${open.id}/membership`, 200, member.cookie)).state,
		"active",
		"repeated admission is idempotent",
	);
	check(
		(
			await database
				.select()
				.from(unitFollow)
				.where(
					and(eq(unitFollow.unitId, open.id), eq(unitFollow.followerProfileId, member.self.id)),
				)
		).length,
		1,
		"Realm admission creates one follow",
	);
	await request("DELETE", `${open.id}/membership`, 204, member.cookie);
	check(
		(
			await database
				.select()
				.from(realmMember)
				.where(and(eq(realmMember.realmId, open.id), eq(realmMember.profileId, member.self.id)))
		).length,
		0,
		"ordinary departure removes the membership",
	);
	await request("PUT", `${open.id}/membership`, 200, member.cookie);

	const approval = await newRealm({ joinPolicy: "approval" });
	check(
		(await request("PUT", `${approval.id}/membership`, 200, member.cookie)).state,
		"pending",
		"approval Realm admission remains pending",
	);
	for (const state of ["banned", "removed"] as const) {
		const subject = await newRealm();
		await database
			.insert(realmMember)
			.values({ realmId: subject.id, profileId: member.self.id, state });
		await request("PUT", `${subject.id}/membership`, 404, member.cookie);
		check(
			(
				await database
					.select()
					.from(realmMember)
					.where(
						and(eq(realmMember.realmId, subject.id), eq(realmMember.profileId, member.self.id)),
					)
			)[0]?.state,
			state,
			"denied admission retains moderation state",
		);
		await request("DELETE", `${subject.id}/membership`, 204, member.cookie);
		await request("PUT", `${subject.id}/membership`, 404, member.cookie);
	}
	const hidden = await newRealm({ visibility: "private" });
	await request("PUT", `${hidden.id}/membership`, 404, member.cookie);
	const draft = await newRealm({ status: "draft" });
	await request("PUT", `${draft.id}/membership`, 404, member.cookie);
	const deleted = await newRealm();
	await database.update(realm).set({ deletedAt: new Date() }).where(eq(realm.id, deleted.id));
	await request("PUT", `${deleted.id}/membership`, 404, member.cookie);
	const moderated = await newRealm({ moderationStatus: "removed" });
	await request("PUT", `${moderated.id}/membership`, 404, member.cookie);
	const explicit = await newRealm();
	const [rules] = await database
		.insert(realmRuleRevision)
		.values({
			realmId: explicit.id,
			version: 1,
			requireOnJoin: true,
			acknowledgementMode: "explicit",
			createdByProfileId: member.self.id,
		})
		.returning();
	assert.ok(rules);
	await request("PUT", `${explicit.id}/membership`, 409, other.cookie);
	await request("PUT", `${explicit.id}/rules/${rules.id}/acknowledgement`, 204, other.cookie, {
		language: "en",
	});
	check(
		(await request("PUT", `${explicit.id}/membership`, 200, other.cookie)).state,
		"active",
		"acknowledging the exact current rules enables admission",
	);
	const implicit = await newRealm();
	const [implicitRules] = await database
		.insert(realmRuleRevision)
		.values({
			realmId: implicit.id,
			version: 1,
			requireOnJoin: true,
			acknowledgementMode: "implicit_on_follow",
			createdByProfileId: member.self.id,
		})
		.returning();
	assert.ok(implicitRules);
	await request("PUT", `${implicit.id}/membership`, 200, other.cookie);
	check(
		(
			await database
				.select()
				.from(realmRuleAcceptance)
				.where(
					and(
						eq(realmRuleAcceptance.revisionId, implicitRules.id),
						eq(realmRuleAcceptance.profileId, other.self.id),
					),
				)
		).length,
		1,
		"implicit acceptance is recorded with membership and follow",
	);

	const managed = await newRealm(),
		moderator = await actor("Realm moderator");
	await database
		.insert(unitOwnership)
		.values({ unitId: managed.id, profileId: member.self.id, assignedByProfileId: member.self.id });
	await database.insert(realmMember).values([
		{ realmId: managed.id, profileId: member.self.id, state: "active" },
		{ realmId: managed.id, profileId: other.self.id, state: "active" },
	]);
	await request("DELETE", `${managed.id}/membership`, 409, member.cookie);
	await request("PATCH", `${managed.id}/members/${other.self.id}`, 403, moderator.cookie, {
		state: "muted",
	});
	const [managerGrant] = await database
		.insert(unitAccessGrant)
		.values({
			unitId: managed.id,
			subjectKind: "auth",
			authUserId: moderator.account.id,
			permission: "realm.members.manage",
			scope: [],
			grantedByAuthUserId: member.account.id,
		})
		.returning();
	assert.ok(managerGrant);
	check(
		(
			await request("PATCH", `${managed.id}/members/${other.self.id}`, 200, moderator.cookie, {
				state: "muted",
			})
		).state,
		"muted",
		"authorized moderation changes the member",
	);
	await request("PATCH", `${managed.id}/members/${member.self.id}`, 409, moderator.cookie, {
		state: "banned",
	});
	check(
		(
			await request("PATCH", `${managed.id}/members/${other.self.id}`, 200, moderator.cookie, {
				state: "active",
			})
		).state,
		"active",
		"only authorized moderation removes the mute",
	);

	// Domain commands run on independent connections after the stateful route cases.
	const { joinRealm, leaveRealm, updateRealmMember } = await import(
		"../src/services/realms/membership"
	);
	const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 14000 });
	const raceDb = drizzle({ client: pool });
	async function blocked(pid: number, blocker: number) {
		for (let attempt = 0; attempt < 500; attempt++) {
			const result = await pool.query<{ blocked: boolean }>(
				"select $2::integer = any(pg_blocking_pids($1)) as blocked",
				[pid, blocker],
			);
			if (result.rows[0]?.blocked) return;
			await setTimeout(10);
		}
		throw new Error("Expected the exact Realm admission blocker");
	}
	try {
		for (const change of ["approval", "ban", "new-ban", "rules"] as const) {
			const subject = await newRealm(),
				guest = await actor(`Waiting Realm ${change}`);
			if (change === "ban")
				await database
					.insert(realmMember)
					.values({ realmId: subject.id, profileId: guest.self.id, state: "active" });
			const held = Promise.withResolvers<number>(),
				release = Promise.withResolvers<void>(),
				waiting = Promise.withResolvers<number>();
			const writer = raceDb.transaction(async (tx) => {
				if (change === "ban")
					await tx
						.update(realmMember)
						.set({ state: "banned" })
						.where(
							and(eq(realmMember.realmId, subject.id), eq(realmMember.profileId, guest.self.id)),
						);
				else if (change === "new-ban")
					await tx
						.insert(realmMember)
						.values({ realmId: subject.id, profileId: guest.self.id, state: "banned" });
				else {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${subject.id}::text, 0))`,
					);
					if (change === "approval")
						await tx.update(realm).set({ joinPolicy: "approval" }).where(eq(realm.id, subject.id));
					else
						await tx.insert(realmRuleRevision).values({
							realmId: subject.id,
							version: 1,
							requireOnJoin: true,
							acknowledgementMode: "explicit",
							createdByProfileId: member.self.id,
						});
				}
				held.resolve(
					(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
				);
				await release.promise;
			});
			void writer.catch(held.reject);
			const holder = await held.promise;
			const joining = raceDb.transaction(async (tx) => {
				waiting.resolve(
					(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
				);
				return joinRealm(tx, guest.authorization, subject.id);
			});
			void joining.catch(waiting.reject);
			const observed =
				change === "approval"
					? joining.then((result) =>
							check(result.state, "pending", "waiting admission uses committed approval policy"),
						)
					: assert
							.rejects(
								joining,
								change === "ban" || change === "new-ban"
									? RealmNotFound
									: RealmRulesAcceptanceRequired,
							)
							.then(() => {
								checks++;
							});
			void observed.catch(() => {});
			try {
				await blocked(await waiting.promise, holder);
				checks++;
			} finally {
				release.resolve();
				await writer;
				await observed;
			}
			if (change !== "approval")
				check(
					(
						await database
							.select()
							.from(unitFollow)
							.where(
								and(
									eq(unitFollow.unitId, subject.id),
									eq(unitFollow.followerProfileId, guest.self.id),
								),
							)
					).length,
					0,
					"denied Realm admission creates no follow",
				);
		}
		const winnerRealm = await newRealm(),
			winnerMember = await actor("Realm admission winner");
		const held = Promise.withResolvers<number>(),
			release = Promise.withResolvers<void>(),
			waiting = Promise.withResolvers<number>();
		const admitted = raceDb.transaction(async (tx) => {
			check(
				(await joinRealm(tx, winnerMember.authorization, winnerRealm.id)).state,
				"active",
				"admitted Realm join commits before later moderation",
			);
			held.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await release.promise;
		});
		void admitted.catch(held.reject);
		const holder = await held.promise;
		const moderation = raceDb.transaction(async (tx) => {
			waiting.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			// The membership inserted by the first transaction is invisible until commit;
			// the conflicting insertion exercises the same PK row serialization as a retry.
			await tx
				.insert(realmMember)
				.values({ realmId: winnerRealm.id, profileId: winnerMember.self.id, state: "banned" })
				.onConflictDoUpdate({
					target: [realmMember.realmId, realmMember.profileId],
					set: { state: "banned" },
				});
		});
		void moderation.catch(waiting.reject);
		try {
			await blocked(await waiting.promise, holder);
			checks++;
		} finally {
			release.resolve();
			await admitted;
			await moderation;
		}
		check(
			(
				await raceDb
					.select()
					.from(realmMember)
					.where(
						and(
							eq(realmMember.realmId, winnerRealm.id),
							eq(realmMember.profileId, winnerMember.self.id),
						),
					)
			)[0]?.state,
			"banned",
			"later moderation retains its final state",
		);

		// A cached permission cannot survive a grant revocation at the write fence.
		await moderator.authorization.realm.ensureCapability(managed.id, "realm.members.manage");
		const revoked = Promise.withResolvers<number>(),
			releaseRevocation = Promise.withResolvers<void>(),
			changing = Promise.withResolvers<number>();
		const revoker = raceDb.transaction(async (tx) => {
			await lockUnitAccessState(tx, [managed.id]);
			await tx
				.update(unitAccessGrant)
				.set({ revokedAt: new Date(), revokedByAuthUserId: member.account.id })
				.where(eq(unitAccessGrant.id, managerGrant.id));
			revoked.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await releaseRevocation.promise;
		});
		void revoker.catch(revoked.reject);
		const revokerPid = await revoked.promise;
		const changingMember = raceDb.transaction(async (tx) => {
			changing.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			return updateRealmMember(tx, moderator.authorization, managed.id, other.self.id, "banned");
		});
		void changingMember.catch(changing.reject);
		const deniedChange = assert.rejects(changingMember, RealmCapabilityRequired);
		void deniedChange.catch(() => {});
		try {
			await blocked(await changing.promise, revokerPid);
			checks++;
		} finally {
			releaseRevocation.resolve();
			await revoker;
			await deniedChange;
			checks++;
		}
		check(
			(
				await raceDb
					.select()
					.from(realmMember)
					.where(and(eq(realmMember.realmId, managed.id), eq(realmMember.profileId, other.self.id)))
			)[0]?.state,
			"active",
			"revoked moderator writes no member state",
		);

		const transferRealm = await newRealm(),
			recipient = await actor("Ownership-before-departure member");
		await database
			.insert(realmMember)
			.values({ realmId: transferRealm.id, profileId: recipient.self.id, state: "active" });
		const assigned = Promise.withResolvers<number>(),
			releaseAssignment = Promise.withResolvers<void>(),
			leaving = Promise.withResolvers<number>();
		const transfer = raceDb.transaction(async (tx) => {
			await lockUnitAccessState(tx, [transferRealm.id]);
			await tx.insert(unitOwnership).values({
				unitId: transferRealm.id,
				profileId: recipient.self.id,
				assignedByProfileId: member.self.id,
			});
			assigned.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await releaseAssignment.promise;
		});
		void transfer.catch(assigned.reject);
		const transferPid = await assigned.promise;
		const departure = raceDb.transaction(async (tx) => {
			leaving.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			return leaveRealm(tx, recipient.authorization, transferRealm.id);
		});
		void departure.catch(leaving.reject);
		const deniedDeparture = assert.rejects(departure, RealmOwnerLeaveForbidden);
		void deniedDeparture.catch(() => {});
		try {
			await blocked(await leaving.promise, transferPid);
			checks++;
		} finally {
			releaseAssignment.resolve();
			await transfer;
			await deniedDeparture;
			checks++;
		}
		check(
			(
				await raceDb
					.select()
					.from(realmMember)
					.where(
						and(
							eq(realmMember.realmId, transferRealm.id),
							eq(realmMember.profileId, recipient.self.id),
						),
					)
			).length,
			1,
			"a newly assigned owner cannot depart",
		);

		const stale = await actor("Stale Realm self binding"),
			subject = await newRealm();
		await database
			.update(authEntity)
			.set({ revision: stale.self.authorizationRevision + 1 })
			.where(eq(authEntity.authUserId, stale.account.id));
		await assert.rejects(
			raceDb.transaction((tx) => joinRealm(tx, stale.authorization, subject.id)),
			ParticipationDenied,
		);
		checks++;
	} finally {
		await pool.end();
	}
} finally {
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-realm-membership.ts",
	"services/main/src/services/realms/membership.ts",
	"services/main/src/services/api/realms/index.ts",
	"services/main/src/services/authorization/realm/policy.ts",
	"services/main/src/services/realms/rule-revision-lock.ts",
	"services/main/scripts/check-realm-governance-projection.ts",
	"services/main/src/services/database/schema/postgres/platform-aggregates.sql",
	"services/main/src/services/database/schema/postgres/manifest.ts",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: (
			await database.execute(
				sql`select version() as postgres, current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		httpChecks,
		realmAdmissionQualified: true,
		departureModerationRetentionQualified: true,
		directModeratorRevocationQualified: true,
		ownerDepartureFenceQualified: true,
	}),
);
console.info(
	`Verified ${checks} Realm membership assertions; generated actors remain only on the disposable target.`,
);
process.exit(0);
