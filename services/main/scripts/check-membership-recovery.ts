import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { authEntity, entityParticipation } from "@rezics/schema/postgres/access/participation";
import { platformCapabilityGrant } from "@rezics/schema/postgres/realms/realm";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createManagedOrganization } from "../src/services/participation/organizations";
import {
	inviteOrganizationMember,
	acceptMembershipInvitation,
	listOwnMembershipInvitations,
} from "../src/services/participation/membership";
import {
	issueParticipationGrant,
	revokeParticipationGrant,
} from "../src/services/participation/commands";
import {
	hasEntityController,
	recoverEntityController,
	suspendUncontrolledEntity,
} from "../src/services/participation/lifecycle";
import {
	ParticipationDenied,
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Membership recovery requires a disposable loopback target",
);
async function actor(tx: DatabaseTransaction, name: string) {
	const [account] = await tx
		.insert(users)
		.values({ name, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	const authority: ParticipationAuthority = {
		principal: { kind: "auth", authUserId: account.id },
		actingEntityId: self.id,
		authorizationRevision: self.authorizationRevision,
	};
	return { account, self, authority };
}
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function rejected(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
) {
	await assert.rejects(tx.transaction(work));
	checks++;
}
async function waitPast(tx: DatabaseTransaction, deadline: Date) {
	for (let attempt = 0; attempt < 300; attempt++) {
		const result = await tx.execute<{ expired: boolean }>(
			sql`select clock_timestamp() > ${deadline.toISOString()}::timestamptz + interval '25 milliseconds' as expired`,
		);
		if (result.rows[0]?.expired) return;
		await setTimeout(10);
	}
	throw new Error("Database clock did not reach the fixture expiry");
}
const rollback = new Error("rollback membership recovery fixture");
try {
	await withDatabaseTransactionDeadline(30000, () =>
		database.transaction(async (tx) => {
			const owner = await actor(tx, "Generation owner"),
				guest = await actor(tx, "Generation guest"),
				operator = await actor(tx, "Recovery operator"),
				expiringOperator = await actor(tx, "Expiring recovery operator");
			const organization = await runWithParticipationAuthority(owner.authority, () =>
				createManagedOrganization(tx, owner.authority, {
					name: "Recovery-generation organization",
					language: "en",
				}),
			);
			const memberGrant = organization.grants.find((g) => g.capability === "entity.membership"),
				securityGrant = organization.grants.find((g) => g.capability === "entity.security");
			assert.ok(memberGrant && securityGrant);
			let manager: ParticipationAuthority = {
				...owner.authority,
				actingEntityId: organization.entityId,
				grant: { id: memberGrant.id, revision: memberGrant.revision },
			};
			const security: ParticipationAuthority = {
				...owner.authority,
				actingEntityId: organization.entityId,
				grant: { id: securityGrant.id, revision: securityGrant.revision },
			};
			const pending = await inviteOrganizationMember(tx, manager, organization.entityId, {
				recipientEntityId: guest.self.id,
			});
			await tx
				.update(authEntity)
				.set({ state: "suspended", revision: 2 })
				.where(eq(authEntity.authUserId, guest.account.id));
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(
					nested,
					{ ...guest.authority, authorizationRevision: 2 },
					pending.id,
					1,
				),
			);
			await tx
				.update(authEntity)
				.set({ state: "active", revision: 3 })
				.where(eq(authEntity.authUserId, guest.account.id));
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, guest.authority, pending.id, 1),
			);
			guest.authority.authorizationRevision = 3;
			await revokeParticipationGrant(tx, security, securityGrant.id, securityGrant.revision);
			let [state] = await tx
				.select()
				.from(entityParticipation)
				.where(eq(entityParticipation.entityId, organization.entityId));
			check(state?.state, "recovery_required", "removing the final controller opens recovery");
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, guest.authority, pending.id, 1),
			);
			await rejected(tx, (nested) =>
				recoverEntityController(nested, operator.authority, {
					entityId: organization.entityId,
					recipientAuthUserId: owner.account.id,
					expectedRevision: state!.revision,
					evidence: "Fixture recovery",
				}),
			);
			await tx.insert(platformCapabilityGrant).values({
				authUserId: operator.account.id,
				grantedByAuthUserId: operator.account.id,
				capability: "platform.access.manage",
			});
			const recovered = await recoverEntityController(tx, operator.authority, {
				entityId: organization.entityId,
				recipientAuthUserId: owner.account.id,
				expectedRevision: state!.revision,
				evidence: "Fixture current platform authority",
			});
			check(
				recovered.revision,
				state!.revision + 1,
				"recovery advances the organization's generation",
			);
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, guest.authority, pending.id, 1),
			);
			check(
				(await listOwnMembershipInvitations(tx, guest.authority, {})).items.find(
					(i) => i.id === pending.id,
				)?.state,
				"invalidated",
				"old pending invitations remain invalid after recovery",
			);
			const fresh = await inviteOrganizationMember(tx, manager, organization.entityId, {
				recipientEntityId: guest.self.id,
			});
			check(
				fresh.id === pending.id,
				false,
				"a recovered generation issues a new invitation identity",
			);
			check(
				(await acceptMembershipInvitation(tx, guest.authority, fresh.id, 1)).state,
				"accepted",
				"fresh authority and recipient revision can accept",
			);
			const issuerPending = await inviteOrganizationMember(tx, manager, organization.entityId, {
				recipientEntityId: operator.self.id,
			});
			await tx
				.update(authEntity)
				.set({ state: "suspended", revision: 2 })
				.where(eq(authEntity.authUserId, owner.account.id));
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, operator.authority, issuerPending.id, 1),
			);
			await tx
				.update(authEntity)
				.set({ state: "active", revision: 3 })
				.where(eq(authEntity.authUserId, owner.account.id));
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, operator.authority, issuerPending.id, 1),
			);
			manager = { ...manager, authorizationRevision: 3 };
			const currentSecurity: ParticipationAuthority = { ...manager, grant: recovered.grant };
			const membershipExpiry = new Date(Date.now() + 500);
			const temporaryManager = await issueParticipationGrant(tx, currentSecurity, {
				recipient: { kind: "auth", authUserId: operator.account.id },
				actingEntityId: organization.entityId,
				capability: "entity.membership",
				target: { owner: "entity", id: organization.entityId },
				expiresAt: membershipExpiry,
			});
			const expiresWithManager = await inviteOrganizationMember(
				tx,
				{
					...operator.authority,
					actingEntityId: organization.entityId,
					grant: temporaryManager,
				},
				organization.entityId,
				{ recipientEntityId: expiringOperator.self.id },
			);
			await waitPast(tx, membershipExpiry);
			check(
				(await listOwnMembershipInvitations(tx, expiringOperator.authority, {})).items.find(
					(i) => i.id === expiresWithManager.id,
				)?.state,
				"invalidated",
				"an expired issuer grant invalidates a pending invitation inside the same transaction",
			);
			await rejected(tx, (nested) =>
				acceptMembershipInvitation(nested, expiringOperator.authority, expiresWithManager.id, 1),
			);
			const controllerExpiry = new Date(Date.now() + 500);
			await issueParticipationGrant(tx, currentSecurity, {
				recipient: { kind: "auth", authUserId: operator.account.id },
				actingEntityId: organization.entityId,
				capability: "entity.security",
				target: { owner: "entity", id: organization.entityId },
				expiresAt: controllerExpiry,
			});
			await revokeParticipationGrant(
				tx,
				currentSecurity,
				recovered.grant.id,
				recovered.grant.revision,
			);
			check(
				await hasEntityController(tx, organization.entityId),
				true,
				"the unexpired replacement controller preserves control",
			);
			await waitPast(tx, controllerExpiry);
			check(
				await hasEntityController(tx, organization.entityId),
				false,
				"controller expiry takes effect inside an open transaction",
			);
			check(
				await suspendUncontrolledEntity(tx, organization.entityId),
				true,
				"expired final control opens recovery",
			);
			[state] = await tx
				.select()
				.from(entityParticipation)
				.where(eq(entityParticipation.entityId, organization.entityId));
			const [platform] = await tx
				.insert(platformCapabilityGrant)
				.values({
					authUserId: expiringOperator.account.id,
					grantedByAuthUserId: operator.account.id,
					capability: "platform.access.manage",
					expiresAt: sql`clock_timestamp() + interval '500 milliseconds'`,
				})
				.returning();
			assert.ok(platform?.expiresAt);
			await waitPast(tx, platform.expiresAt);
			await assert.rejects(
				tx.transaction((nested) =>
					recoverEntityController(nested, expiringOperator.authority, {
						entityId: organization.entityId,
						recipientAuthUserId: owner.account.id,
						expectedRevision: state!.revision,
						evidence: "Expired authority must not recover",
					}),
				),
				ParticipationDenied,
			);
			checks++;
			throw rollback;
		}),
	);
} catch (cause) {
	if (cause !== rollback) throw cause;
}
const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 10000 });
const raceDb = drizzle({ client: pool });
try {
	const seeded = await raceDb.transaction(async (tx) => {
		const owner = await actor(tx, "Recovery wait owner"),
			operator = await actor(tx, "Recovery wait operator");
		const org = await runWithParticipationAuthority(owner.authority, () =>
			createManagedOrganization(tx, owner.authority, {
				name: "Recovery wait organization",
				language: "en",
			}),
		);
		const security = org.grants.find((g) => g.capability === "entity.security");
		assert.ok(security);
		await revokeParticipationGrant(
			tx,
			{
				...owner.authority,
				actingEntityId: org.entityId,
				grant: { id: security.id, revision: security.revision },
			},
			security.id,
			security.revision,
		);
		const [state] = await tx
			.select()
			.from(entityParticipation)
			.where(eq(entityParticipation.entityId, org.entityId));
		assert.ok(state);
		const [platform] = await tx
			.insert(platformCapabilityGrant)
			.values({
				authUserId: operator.account.id,
				grantedByAuthUserId: operator.account.id,
				capability: "platform.access.manage",
				expiresAt: sql`clock_timestamp() + interval '2 seconds'`,
			})
			.returning();
		assert.ok(platform?.expiresAt);
		return { owner, operator, org, state, platform };
	});
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		waiting = Promise.withResolvers<number>();
	const holder = raceDb.transaction(async (tx) => {
		await tx
			.select({ id: entityParticipation.entityId })
			.from(entityParticipation)
			.where(eq(entityParticipation.entityId, seeded.org.entityId))
			.for("update");
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holder.catch(held.reject);
	const holderPid = await held.promise;
	const recovering = raceDb.transaction(async (tx) => {
		waiting.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return recoverEntityController(tx, seeded.operator.authority, {
			entityId: seeded.org.entityId,
			recipientAuthUserId: seeded.owner.account.id,
			expectedRevision: seeded.state.revision,
			evidence: "Authority expires while waiting for the control row",
		});
	});
	void recovering.catch(waiting.reject);
	const denied = assert.rejects(recovering, ParticipationDenied);
	void denied.catch(() => {});
	try {
		const pid = await waiting.promise;
		let blocked = false,
			expired = false;
		for (let attempt = 0; attempt < 500; attempt++) {
			const state = await pool.query<{ blocked: boolean; expired: boolean }>(
				"select $2::integer = any(pg_blocking_pids($1)) as blocked, clock_timestamp() > $3::timestamptz + interval '25 milliseconds' as expired",
				[pid, holderPid, seeded.platform.expiresAt],
			);
			blocked ||= state.rows[0]?.blocked ?? false;
			expired = state.rows[0]?.expired ?? false;
			if (blocked && expired) break;
			await setTimeout(10);
		}
		check(
			blocked && expired,
			true,
			"recovery waits on the exact control lock beyond the operator grant deadline",
		);
	} finally {
		release.resolve();
		await holder;
		await denied;
	}
	const [after] = await raceDb
		.select()
		.from(entityParticipation)
		.where(eq(entityParticipation.entityId, seeded.org.entityId));
	check(after?.revision, seeded.state.revision, "expired recovery appends no control generation");
} finally {
	await pool.end();
}
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-membership-recovery.ts",
	"services/main/src/services/participation/lifecycle.ts",
	"services/main/src/services/participation/membership.ts",
	"services/main/src/services/participation/commands.ts",
	"services/main/src/services/participation/policy.ts",
	"libraries/schema/src/postgres/access/participation.ts",
	"services/main/src/services/database/schema/postgres/organization-membership.sql",
	"services/main/src/services/database/migrations/atlas.sum",
])
	sourceDigests[path] = createHash("sha256")
		.update(await readFile(new URL(path, repository)))
		.digest("hex");
const runtime = await database.execute(
	sql`select version() as postgres, current_setting('default_transaction_isolation') as default_isolation`,
);
console.info(
	JSON.stringify({
		baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
			cwd: fileURLToPath(repository),
			encoding: "utf8",
		}).trim(),
		sourceDigests,
		node: process.version,
		platform: `${process.platform}/${process.arch}`,
		runtime: runtime.rows[0],
		checks,
		recoveryGenerationQualified: true,
		suspendedBindingsQualified: true,
		expiredControlQualified: true,
		recoveryLockWaitQualified: true,
	}),
);
console.info(
	`Verified ${checks} membership generation, suspension and recovery assertions; transaction scenarios rolled back; control-wait actors remain only in the disposable target.`,
);
process.exit(0);
