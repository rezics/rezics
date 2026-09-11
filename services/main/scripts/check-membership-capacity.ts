import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import { organizationMembershipInvitation } from "../src/services/database/schema/organization-membership";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createManagedOrganization } from "../src/services/participation/organizations";
import {
	cancelMembershipInvitation,
	inviteOrganizationMember,
} from "../src/services/participation/membership";
import { OrganizationMembershipCapacityExceeded } from "../src/services/participation/membership-contracts";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Membership capacity requires a disposable loopback target",
);
async function actor(tx: DatabaseTransaction) {
	const [account] = await tx
		.insert(users)
		.values({ name: "", email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
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
async function organization(tx: DatabaseTransaction, owner: Awaited<ReturnType<typeof actor>>) {
	const created = await runWithParticipationAuthority(owner.authority, () =>
		createManagedOrganization(tx, owner.authority, {
			name: "Pending-capacity organization",
			language: "en",
		}),
	);
	const grant = created.grants.find((g) => g.capability === "entity.membership");
	assert.ok(grant);
	const authority: ParticipationAuthority = {
		...owner.authority,
		actingEntityId: created.entityId,
		grant: { id: grant.id, revision: grant.revision },
	};
	return { id: created.entityId, authority };
}
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
const fixture = await withDatabaseTransactionDeadline(120000, () =>
	database.transaction(async (tx) => {
		const owner = await actor(tx),
			org = await organization(tx, owner);
		const guests: Awaited<ReturnType<typeof actor>>[] = [];
		for (let i = 0; i < 1002; i++) guests.push(await actor(tx));
		let firstInvitation: Awaited<ReturnType<typeof inviteOrganizationMember>> | undefined;
		for (let i = 0; i < 1000; i++) {
			const invitation = await inviteOrganizationMember(tx, org.authority, org.id, {
				recipientEntityId: guests[i]!.self.id,
			});
			firstInvitation ??= invitation;
		}
		assert.ok(firstInvitation);
		const pending = async () =>
			(
				await tx.execute<{
					count: number;
				}>(sql`select count(*)::integer as count from ${organizationMembershipInvitation}
			where ${organizationMembershipInvitation.organizationEntityId} = ${org.id}::uuid and ${organizationMembershipInvitation.state} = 'pending'`)
			).rows[0]?.count;
		check(await pending(), 1000, "organization admits exactly its pending limit");
		check(
			(
				await inviteOrganizationMember(tx, org.authority, org.id, {
					recipientEntityId: guests[0]!.self.id,
				})
			).id,
			firstInvitation.id,
			"repeating a pending invitation is allowed at capacity",
		);
		await assert.rejects(
			tx.transaction((nested) =>
				inviteOrganizationMember(nested, org.authority, org.id, {
					recipientEntityId: guests[1000]!.self.id,
				}),
			),
			OrganizationMembershipCapacityExceeded,
		);
		checks++;
		const [template] = await tx
			.select()
			.from(organizationMembershipInvitation)
			.where(eq(organizationMembershipInvitation.id, firstInvitation.id));
		assert.ok(template);
		await assert.rejects(
			tx.transaction((nested) =>
				nested.insert(organizationMembershipInvitation).values({
					...template,
					id: crypto.randomUUID(),
					recipientAuthUserId: guests[1000]!.account.id,
					recipientEntityId: guests[1000]!.self.id,
				}),
			),
			(cause: unknown) => {
				while (cause instanceof Error && cause.cause) cause = cause.cause;
				return (
					cause instanceof Error &&
					cause.message.includes("Organization pending invitation capacity reached")
				);
			},
		);
		checks++;
		await cancelMembershipInvitation(tx, org.authority, org.id, firstInvitation.id, 1);
		const deadline = new Date(Date.now() + 500);
		const short = await inviteOrganizationMember(tx, org.authority, org.id, {
			recipientEntityId: guests[1000]!.self.id,
			expiresAt: deadline.toISOString(),
		});
		check(await pending(), 1000, "cancellation frees exactly one admission slot");
		let expired = false;
		for (let attempt = 0; attempt < 300; attempt++) {
			const result = await tx.execute<{ expired: boolean }>(
				sql`select clock_timestamp() > ${deadline.toISOString()}::timestamptz + interval '25 milliseconds' as expired`,
			);
			if (result.rows[0]?.expired) {
				expired = true;
				break;
			}
			await setTimeout(10);
		}
		assert.ok(expired, "database clock crossed the pending invitation expiry");
		await inviteOrganizationMember(tx, org.authority, org.id, {
			recipientEntityId: guests[1001]!.self.id,
		});
		check(await pending(), 1000, "admission reclaims expired pending capacity");
		check(
			(
				await tx
					.select({ state: organizationMembershipInvitation.state })
					.from(organizationMembershipInvitation)
					.where(eq(organizationMembershipInvitation.id, short.id))
			)[0]?.state,
			"expired",
			"reclamation preserves the old terminal invitation",
		);
		const recipient = await actor(tx);
		const owners = [await actor(tx), await actor(tx), await actor(tx), await actor(tx)];
		let inboxTemplate: typeof organizationMembershipInvitation.$inferSelect | undefined;
		for (let i = 0; i < 1000; i++) {
			const source = await organization(tx, owners[Math.floor(i / 250)]!);
			const invitation = await inviteOrganizationMember(tx, source.authority, source.id, {
				recipientEntityId: recipient.self.id,
			});
			if (i === 0)
				[inboxTemplate] = await tx
					.select()
					.from(organizationMembershipInvitation)
					.where(eq(organizationMembershipInvitation.id, invitation.id));
		}
		const overflowOrg = await organization(tx, owners[0]!);
		await assert.rejects(
			tx.transaction((nested) =>
				inviteOrganizationMember(nested, overflowOrg.authority, overflowOrg.id, {
					recipientEntityId: recipient.self.id,
				}),
			),
			OrganizationMembershipCapacityExceeded,
		);
		checks++;
		check(
			(
				await tx.execute<{
					count: number;
				}>(sql`select count(*)::integer as count from ${organizationMembershipInvitation}
			where ${organizationMembershipInvitation.recipientAuthUserId} = ${recipient.account.id}::uuid and ${organizationMembershipInvitation.state} = 'pending'`)
			).rows[0]?.count,
			1000,
			"recipient inbox independently enforces the same pending limit",
		);
		assert.ok(inboxTemplate);
		assert.ok(overflowOrg.authority.grant);
		const now = new Date();
		await assert.rejects(
			tx.transaction((nested) =>
				nested.insert(organizationMembershipInvitation).values({
					...inboxTemplate,
					id: crypto.randomUUID(),
					organizationEntityId: overflowOrg.id,
					organizationRevision: 1,
					invitedByAuthUserId: owners[0]!.account.id,
					inviterAuthorizationRevision: owners[0]!.authority.authorizationRevision,
					authorizationGrantId: overflowOrg.authority.grant!.id,
					authorizationGrantRevision: overflowOrg.authority.grant!.revision,
					createdAt: now,
					updatedAt: now,
					expiresAt: new Date(now.getTime() + 86400000),
				}),
			),
			(cause: unknown) => {
				while (cause instanceof Error && cause.cause) cause = cause.cause;
				return (
					cause instanceof Error &&
					cause.message.includes("Recipient pending invitation capacity reached")
				);
			},
		);
		checks++;
		await cancelMembershipInvitation(
			tx,
			{
				...owners[0]!.authority,
				actingEntityId: inboxTemplate.organizationEntityId,
				grant: {
					id: inboxTemplate.authorizationGrantId,
					revision: inboxTemplate.authorizationGrantRevision,
				},
			},
			inboxTemplate.organizationEntityId,
			inboxTemplate.id,
			1,
		);
		await inviteOrganizationMember(tx, overflowOrg.authority, overflowOrg.id, {
			recipientEntityId: recipient.self.id,
		});
		check(
			(
				await tx.execute<{
					count: number;
				}>(sql`select count(*)::integer as count from ${organizationMembershipInvitation}
				where ${organizationMembershipInvitation.recipientAuthUserId} = ${recipient.account.id}::uuid and ${organizationMembershipInvitation.state} = 'pending'`)
			).rows[0]?.count,
			1000,
			"recipient cancellation frees exactly one inbox slot",
		);
		return { owner, org, guests, recipient, owners };
	}),
);
const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 20000 });
const raceDb = drizzle({ client: pool });
async function fillLastSlot(
	first: (tx: DatabaseTransaction) => Promise<unknown>,
	second: (tx: DatabaseTransaction) => Promise<unknown>,
) {
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const holder = raceDb.transaction(async (tx) => {
		await first(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holder.catch(ready.reject);
	const holderPid = await ready.promise;
	const contender = raceDb.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return second(tx);
	});
	void contender.catch(started.reject);
	const denied = assert.rejects(contender, OrganizationMembershipCapacityExceeded);
	void denied.catch(() => {});
	try {
		const pid = await started.promise;
		let blocked = false;
		for (let i = 0; i < 200; i++) {
			const row = await pool.query<{ blocked: boolean }>(
				"select $2::integer = any(pg_blocking_pids($1)) as blocked",
				[pid, holderPid],
			);
			if (row.rows[0]?.blocked) {
				blocked = true;
				break;
			}
			await setTimeout(10);
		}
		check(blocked, true, "last-slot contender waits on the winning admission transaction");
	} finally {
		release.resolve();
		await holder;
		await denied;
	}
}
try {
	const [pendingOrg] = await raceDb
		.select()
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.organizationEntityId, fixture.org.id),
				eq(organizationMembershipInvitation.state, "pending"),
			),
		)
		.limit(1);
	assert.ok(pendingOrg);
	await raceDb.transaction((tx) =>
		cancelMembershipInvitation(tx, fixture.org.authority, fixture.org.id, pendingOrg.id, 1),
	);
	const [firstGuest, secondGuest] = await raceDb.transaction(
		async (tx) => [await actor(tx), await actor(tx)] as const,
	);
	await fillLastSlot(
		(tx) =>
			inviteOrganizationMember(tx, fixture.org.authority, fixture.org.id, {
				recipientEntityId: firstGuest.self.id,
			}),
		(tx) =>
			inviteOrganizationMember(tx, fixture.org.authority, fixture.org.id, {
				recipientEntityId: secondGuest.self.id,
			}),
	);
	check(
		(
			await pool.query<{ count: number }>(
				"select count(*)::integer as count from public.organization_membership_invitation where organization_entity_id=$1 and state='pending'",
				[fixture.org.id],
			)
		).rows[0]?.count,
		1000,
		"organization stays at its bound after simultaneous last-slot attempts",
	);
	const [pendingInbox] = await raceDb
		.select()
		.from(organizationMembershipInvitation)
		.where(
			and(
				eq(organizationMembershipInvitation.recipientAuthUserId, fixture.recipient.account.id),
				eq(organizationMembershipInvitation.state, "pending"),
			),
		)
		.limit(1);
	assert.ok(pendingInbox);
	const issuer = fixture.owners.find(
		(owner) => owner.account.id === pendingInbox.invitedByAuthUserId,
	);
	assert.ok(issuer);
	await raceDb.transaction((tx) =>
		cancelMembershipInvitation(
			tx,
			{
				...issuer.authority,
				actingEntityId: pendingInbox.organizationEntityId,
				grant: {
					id: pendingInbox.authorizationGrantId,
					revision: pendingInbox.authorizationGrantRevision,
				},
			},
			pendingInbox.organizationEntityId,
			pendingInbox.id,
			1,
		),
	);
	const [firstOrg, secondOrg] = await raceDb.transaction(
		async (tx) =>
			[
				await organization(tx, fixture.owners[0]!),
				await organization(tx, fixture.owners[0]!),
			] as const,
	);
	await fillLastSlot(
		(tx) =>
			inviteOrganizationMember(tx, firstOrg.authority, firstOrg.id, {
				recipientEntityId: fixture.recipient.self.id,
			}),
		(tx) =>
			inviteOrganizationMember(tx, secondOrg.authority, secondOrg.id, {
				recipientEntityId: fixture.recipient.self.id,
			}),
	);
	check(
		(
			await pool.query<{ count: number }>(
				"select count(*)::integer as count from public.organization_membership_invitation where recipient_auth_user_id=$1 and state='pending'",
				[fixture.recipient.account.id],
			)
		).rows[0]?.count,
		1000,
		"recipient stays at its bound across competing organizations",
	);
} finally {
	await pool.end();
}
const repository = new URL("../../../", import.meta.url);
const sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-membership-capacity.ts",
	"services/main/src/services/participation/membership.ts",
	"services/main/src/services/participation/organizations.ts",
	"services/main/src/services/participation/lifecycle.ts",
	"services/main/src/services/database/schema/organization-membership.ts",
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
		organizationPendingLimit: 1000,
		recipientPendingLimit: 1000,
		exactLastSlotRaces: 2,
		dummyRowsCommittedToDisposableTarget: true,
	}),
);
console.info(
	`Verified ${checks} membership pending-capacity assertions on PostgreSQL; dummy fixture rows remain only in the disposable target for cross-connection verification.`,
);
process.exit(0);
