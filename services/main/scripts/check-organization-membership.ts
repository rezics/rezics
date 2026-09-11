import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { serializeSignedCookie } from "better-call";
import { and, eq, inArray, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { initializeObservability } from "@rezics/observability";
import { users, sessions } from "../src/services/database/schema/auth";
import { accountErasure, participationGrant } from "../src/services/database/schema/participation";
import {
	organizationMembership,
	organizationMembershipEvent,
	organizationMembershipInvitation,
} from "../src/services/database/schema/organization-membership";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { acceptMembershipInvitation } from "../src/services/participation/membership";
import {
	MembershipInvitationSchema,
	MembershipInvitationPageSchema,
	OrganizationMemberPageSchema,
	OrganizationMemberSchema,
} from "../src/services/participation/membership-contracts";
import {
	CreatedOrganizationSchema,
	GrantSelectionSchema,
	ManagedOrganizationsSchema,
} from "../src/services/api/participation/schema";
import {
	issueParticipationGrant,
	revokeParticipationGrant,
} from "../src/services/participation/commands";
import {
	eraseOwnAccount,
	dispatchAccountErasureBatch,
} from "../src/services/participation/erasure";
import { type ParticipationAuthority } from "../src/services/participation/policy";

const connectionString = process.env.DATABASE_URL;
if (!connectionString || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable membership fixture required");
const target = new URL(connectionString);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname) ||
	target.port === "15432"
)
	throw new Error("Membership qualification requires an isolated loopback Atlas target");
const observability = initializeObservability({
	service: { name: "rezics-membership-qualification", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const context = await auth.$context;
const racePool = new Pool({ connectionString, max: 5, statement_timeout: 20_000 });
const raceDatabase = drizzle({ client: racePool });
const fixtureAccounts: { id: string; authority: ParticipationAuthority }[] = [];
let assertions = 0;

function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	assertions++;
}
async function rejected(operation: Promise<unknown>) {
	await assert.rejects(operation);
	assertions++;
}
async function actor(label: string) {
	const person = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({ name: label, email: `${crypto.randomUUID()}@example.invalid`, emailVerified: true })
			.returning();
		assert.ok(account);
		const self = await ensureSelfEntityInTransaction(tx, account);
		const authority: ParticipationAuthority = {
			principal: { kind: "auth", authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		return { account, self, authority };
	});
	fixtureAccounts.push({ id: person.account.id, authority: person.authority });
	const session = await context.internalAdapter.createSession(person.account.id);
	const cookie = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			session.token,
			context.secret,
			{ path: "/" },
		)
	).split(";")[0];
	assert.ok(cookie);
	return { ...person, cookie };
}
type Actor = Awaited<ReturnType<typeof actor>>;
type Selection = { actingEntityId: string; grant: { id: string; revision: number } };

async function request(
	method: string,
	path: string,
	body: unknown,
	status: number,
	person?: Actor,
	selection?: Selection,
) {
	const headers = new Headers({ Accept: "application/json" });
	if (person) headers.set("Cookie", person.cookie);
	if (selection) headers.set("X-Rezics-Participation", JSON.stringify(selection));
	if (body !== undefined) headers.set("Content-Type", "application/json");
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers,
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	assert.equal(response.status, status, `${method} ${path}: ${text.slice(0, 1200)}`);
	assertions++;
	return text ? (JSON.parse(text) as unknown) : null;
}
const prefix = "/participation/membership";
async function invite(owner: Actor, selection: Selection, recipient: Actor, expiresAt?: string) {
	return MembershipInvitationSchema.parse(
		await request(
			"POST",
			`${prefix}/organizations/${selection.actingEntityId}/invitations`,
			{ recipientEntityId: recipient.self.id, ...(expiresAt ? { expiresAt } : {}) },
			200,
			owner,
			selection,
		),
	);
}
async function drainErasure(authUserId: string) {
	for (let index = 0; index < 120; index++) {
		await database
			.update(accountErasure)
			.set({ availableAt: new Date(0) })
			.where(eq(accountErasure.authUserId, authUserId));
		const progressed = await dispatchAccountErasureBatch({ authUserId });
		assert.ok(progressed <= 500);
		const [job] = await database
			.select({ stage: accountErasure.stage })
			.from(accountErasure)
			.where(eq(accountErasure.authUserId, authUserId));
		if (job?.stage === "complete") return;
	}
	throw new Error("Membership erasure failed to reach completion within bounded stages");
}
function deferred<T>() {
	let resolve!: (value: T) => void;
	const promise = new Promise<T>((complete) => {
		resolve = complete;
	});
	return { promise, resolve };
}
async function waitForBlocked(pid: number, blockerPid: number) {
	for (let index = 0; index < 100; index++) {
		const result = await racePool.query<{ blocked: boolean }>(
			"select $2::integer = any(pg_blocking_pids($1)) as blocked",
			[pid, blockerPid],
		);
		if (result.rows[0]?.blocked) {
			assertions++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("Expected concurrent membership authority to block on its transaction fence");
}

try {
	// These small dummy fixtures commit so signed sessions and separate SQL connections see the same rows.
	// Private data is erased below; immutable public/operator evidence remains only in this disposable target.
	const owner = await actor("Membership fixture owner");
	const alice = await actor("Membership fixture Alice");
	const bob = await actor("Membership fixture Bob");
	const carol = await actor("Membership fixture Carol");
	const organization = CreatedOrganizationSchema.parse(
		await request(
			"POST",
			"/participation/organizations",
			{ name: "Membership fixture organization", language: "en" },
			200,
			owner,
		),
	);
	const memberGrant = organization.grants.find((grant) => grant.capability === "entity.membership");
	const securityGrant = organization.grants.find((grant) => grant.capability === "entity.security");
	const publishGrant = organization.grants.find((grant) => grant.capability === "entity.publish");
	assert.ok(memberGrant && securityGrant && publishGrant);
	const selection = {
		actingEntityId: organization.entityId,
		grant: { id: memberGrant.id, revision: memberGrant.revision },
	};
	const security = {
		actingEntityId: organization.entityId,
		grant: { id: securityGrant.id, revision: securityGrant.revision },
	};
	const publication = {
		actingEntityId: organization.entityId,
		grant: { id: publishGrant.id, revision: publishGrant.revision },
	};
	const securityAuthority: ParticipationAuthority = { ...owner.authority, ...security };
	const rosterPath = `${prefix}/organizations/${organization.entityId}/members`;
	await request("GET", rosterPath, undefined, 401);
	await request("GET", rosterPath, undefined, 403, owner, security);
	await request("GET", rosterPath, undefined, 403, owner, publication);
	await request("GET", rosterPath, undefined, 403, bob);
	await request(
		"POST",
		"/participation/grants",
		{
			recipient: { kind: "account", entityId: alice.self.id },
			actingEntityId: owner.self.id,
			capability: "entity.membership",
			target: { owner: "entity", id: owner.self.id },
		},
		403,
		owner,
	);
	check(
		OrganizationMemberPageSchema.parse(
			await request("GET", rosterPath, undefined, 200, owner, selection),
		).items.length,
		0,
		"Creating the organization does not silently enroll its controller",
	);
	const delegatedMembership = GrantSelectionSchema.parse(
		await request(
			"POST",
			"/participation/grants",
			{
				recipient: { kind: "account", entityId: bob.self.id },
				actingEntityId: organization.entityId,
				capability: "entity.membership",
				target: { owner: "entity", id: organization.entityId },
			},
			200,
			owner,
			security,
		),
	);
	check(
		OrganizationMemberPageSchema.parse(
			await request("GET", rosterPath, undefined, 200, bob, {
				actingEntityId: organization.entityId,
				grant: delegatedMembership,
			}),
		).items.length,
		0,
		"A membership manager is not silently enrolled in the roster",
	);
	const catalogGrant = GrantSelectionSchema.parse(
		await request(
			"POST",
			"/participation/grants",
			{
				recipient: { kind: "account", entityId: carol.self.id },
				actingEntityId: carol.self.id,
				capability: "catalog.edit",
				target: { owner: "entity", id: organization.entityId },
			},
			200,
			owner,
		),
	);
	await request("GET", rosterPath, undefined, 403, carol, {
		actingEntityId: carol.self.id,
		grant: catalogGrant,
	});
	check(
		ManagedOrganizationsSchema.parse(
			await request(
				"GET",
				"/participation/organizations?capability=entity.membership",
				undefined,
				200,
				owner,
			),
		).items.some((item) => item.entityId === organization.entityId),
		true,
		"Membership managers can locate their exact organization role",
	);
	await request(
		"POST",
		`${prefix}/organizations/${organization.entityId}/invitations`,
		{ recipientEntityId: alice.self.id, recipientAuthUserId: alice.account.id },
		422,
		owner,
		selection,
	);
	const invitation = await invite(owner, selection, alice);
	check(
		(await invite(owner, selection, alice)).id,
		invitation.id,
		"Repeating a pending invitation does not create another identity",
	);
	check(
		JSON.stringify(invitation).includes(alice.account.id) ||
			JSON.stringify(invitation).includes(owner.account.id),
		false,
		"Invitation wire response excludes private Auth identities",
	);
	check(
		MembershipInvitationPageSchema.parse(
			await request("GET", `${prefix}/me/invitations`, undefined, 200, bob),
		).items.length,
		0,
		"An unrelated inbox remains private",
	);
	check(
		MembershipInvitationPageSchema.parse(
			await request("GET", `${prefix}/me/invitations`, undefined, 200, alice),
		).items[0]?.id,
		invitation.id,
		"Only the addressed account sees the incoming invitation",
	);
	await request(
		"POST",
		`${prefix}/invitations/${invitation.id}/accept`,
		{ expectedRevision: 1 },
		404,
		bob,
	);
	await rejected(
		database.transaction((tx) =>
			tx
				.update(organizationMembershipInvitation)
				.set({
					state: "accepted",
					revision: 2,
					resolvedAt: new Date(),
					resolvedByAuthUserId: bob.account.id,
				})
				.where(eq(organizationMembershipInvitation.id, invitation.id)),
		),
	);
	await rejected(
		database.transaction((tx) =>
			tx
				.update(organizationMembershipInvitation)
				.set({ recipientEntityId: bob.self.id })
				.where(eq(organizationMembershipInvitation.id, invitation.id)),
		),
	);
	await rejected(
		database.transaction((tx) =>
			tx.insert(organizationMembership).values({
				organizationEntityId: organization.entityId,
				memberAuthUserId: alice.account.id,
				memberEntityId: alice.self.id,
				acceptedInvitationId: invitation.id,
				joinedAt: new Date(),
			}),
		),
	);
	const beforeGrants = await database
		.select({ id: participationGrant.id })
		.from(participationGrant)
		.where(eq(participationGrant.authUserId, alice.account.id));
	const accepted = MembershipInvitationSchema.parse(
		await request(
			"POST",
			`${prefix}/invitations/${invitation.id}/accept`,
			{ expectedRevision: 1 },
			200,
			alice,
		),
	);
	check(accepted.state, "accepted", "The recipient explicitly accepts");
	await request(
		"POST",
		`${prefix}/invitations/${invitation.id}/accept`,
		{ expectedRevision: 1 },
		409,
		alice,
	);
	check(
		(
			await database
				.select({ id: participationGrant.id })
				.from(participationGrant)
				.where(eq(participationGrant.authUserId, alice.account.id))
		).length,
		beforeGrants.length,
		"Acceptance grants no publishing, security or catalog authority",
	);
	await request(
		"POST",
		"/participation/acting",
		{
			actingEntityId: organization.entityId,
			capability: "entity.publish",
			target: { owner: "entity", id: organization.entityId },
		},
		403,
		alice,
	);
	const roster = OrganizationMemberPageSchema.parse(
		await request("GET", rosterPath, undefined, 200, owner, selection),
	);
	check(
		roster.items.map((member) => member.memberEntityId),
		[alice.self.id],
		"The manager sees public member identities after consent",
	);
	check(
		JSON.stringify(roster).includes(alice.account.id),
		false,
		"Roster wire response excludes Auth identities",
	);
	await request("PATCH", "/account/me/preferences", { interfaceLocale: "ja" }, 200, alice);
	await request("PATCH", "/account/me/preferences", { interfaceLocale: "en" }, 200, owner);
	const ownPreferences = await request(
		"GET",
		"/account/me/preferences",
		undefined,
		200,
		owner,
		selection,
	);
	assert.ok(
		ownPreferences && typeof ownPreferences === "object" && "interfaceLocale" in ownPreferences,
	);
	check(
		ownPreferences.interfaceLocale,
		"en",
		"Managing a roster does not select a member's private preferences",
	);
	await request(
		"POST",
		`${prefix}/organizations/${organization.entityId}/members/${alice.self.id}/remove`,
		{ expectedRevision: 99 },
		409,
		owner,
		selection,
	);
	check(
		OrganizationMemberSchema.parse(
			await request(
				"POST",
				`${prefix}/organizations/${organization.entityId}/members/${alice.self.id}/remove`,
				{ expectedRevision: 1 },
				200,
				owner,
				selection,
			),
		).revision,
		2,
		"Manager removal advances the member revision",
	);
	const rejoin = await invite(owner, selection, alice);
	await request(
		"POST",
		`${prefix}/invitations/${rejoin.id}/accept`,
		{ expectedRevision: 1 },
		200,
		alice,
	);
	check(
		OrganizationMemberPageSchema.parse(
			await request("GET", `${prefix}/me/organizations`, undefined, 200, alice),
		).items[0]?.revision,
		3,
		"A new accepted invitation rejoins the same membership identity",
	);
	await request(
		"POST",
		`${prefix}/me/organizations/${organization.entityId}/leave`,
		{ expectedRevision: 3 },
		200,
		alice,
	);
	const events = await database
		.select()
		.from(organizationMembershipEvent)
		.where(
			and(
				eq(organizationMembershipEvent.organizationEntityId, organization.entityId),
				eq(organizationMembershipEvent.memberAuthUserId, alice.account.id),
			),
		)
		.orderBy(organizationMembershipEvent.revision);
	check(
		events.map((event) => event.operation),
		["join", "remove", "join", "leave"],
		"Rejoin preserves all prior membership transitions",
	);
	check(
		events.map((event) => event.operatorAuthUserId),
		[alice.account.id, owner.account.id, alice.account.id, alice.account.id],
		"Transition evidence preserves each actual operator",
	);
	await rejected(
		database.transaction((tx) =>
			tx
				.delete(organizationMembershipEvent)
				.where(eq(organizationMembershipEvent.memberAuthUserId, alice.account.id)),
		),
	);
	const declined = await invite(owner, selection, bob);
	await request(
		"POST",
		`${prefix}/invitations/${declined.id}/decline`,
		{ expectedRevision: 1 },
		200,
		bob,
	);
	await request(
		"POST",
		`${prefix}/invitations/${declined.id}/accept`,
		{ expectedRevision: 2 },
		409,
		bob,
	);
	const cancelled = await invite(owner, selection, carol);
	await request(
		"POST",
		`${prefix}/organizations/${organization.entityId}/invitations/${cancelled.id}/cancel`,
		{ expectedRevision: 1 },
		403,
		owner,
		security,
	);
	await request(
		"POST",
		`${prefix}/organizations/${organization.entityId}/invitations/${cancelled.id}/cancel`,
		{ expectedRevision: 1 },
		200,
		owner,
		selection,
	);
	await request(
		"POST",
		`${prefix}/invitations/${cancelled.id}/accept`,
		{ expectedRevision: 2 },
		409,
		carol,
	);
	const expiring = await invite(owner, selection, bob, new Date(Date.now() + 2000).toISOString());
	await setTimeout(2200);
	await request(
		"POST",
		`${prefix}/invitations/${expiring.id}/accept`,
		{ expectedRevision: 1 },
		409,
		bob,
	);
	const afterExpiry = await invite(owner, selection, bob);
	check(afterExpiry.id === expiring.id, false, "Expired invitations do not reopen on reissue");
	check(
		(
			await database
				.select()
				.from(organizationMembershipInvitation)
				.where(eq(organizationMembershipInvitation.id, expiring.id))
		)[0]?.state,
		"expired",
		"Admission reclaims only its bounded expired pending set",
	);

	// Acceptance completes before revocation: the revoker must wait for the committed effect.
	const acceptedBeforeRevoke = deferred<number>(),
		releaseAcceptance = deferred<void>(),
		revokerPid = deferred<number>();
	const accepting = raceDatabase.transaction(async (tx) => {
		await acceptMembershipInvitation(tx, bob.authority, afterExpiry.id, 1);
		acceptedBeforeRevoke.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await releaseAcceptance.promise;
	});
	await Promise.race([acceptedBeforeRevoke.promise, accepting]);
	const revoking = raceDatabase.transaction(async (tx) => {
		const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
		revokerPid.resolve(result.rows[0]!.pid);
		await revokeParticipationGrant(
			tx,
			securityAuthority,
			selection.grant.id,
			selection.grant.revision,
		);
	});
	try {
		await waitForBlocked(await revokerPid.promise, await acceptedBeforeRevoke.promise);
	} finally {
		releaseAcceptance.resolve();
	}
	await Promise.all([accepting, revoking]);
	check(
		(
			await database
				.select()
				.from(organizationMembership)
				.where(
					and(
						eq(organizationMembership.organizationEntityId, organization.entityId),
						eq(organizationMembership.memberAuthUserId, bob.account.id),
					),
				)
		)[0]?.removedAt,
		null,
		"An already accepted membership survives later issuer grant revocation",
	);

	const replacementGrant = await database.transaction((tx) =>
		issueParticipationGrant(tx, securityAuthority, {
			recipient: { kind: "auth", authUserId: owner.account.id },
			actingEntityId: organization.entityId,
			capability: "entity.membership",
			target: { owner: "entity", id: organization.entityId },
		}),
	);
	const replacement = { actingEntityId: organization.entityId, grant: replacementGrant };
	const deniedInvitation = await invite(owner, replacement, carol);
	const revokedBeforeAcceptance = deferred<number>(),
		releaseRevocation = deferred<void>(),
		accepterPid = deferred<number>();
	const revokeFirst = raceDatabase.transaction(async (tx) => {
		await revokeParticipationGrant(
			tx,
			securityAuthority,
			replacementGrant.id,
			replacementGrant.revision,
		);
		revokedBeforeAcceptance.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await releaseRevocation.promise;
	});
	await Promise.race([revokedBeforeAcceptance.promise, revokeFirst]);
	const acceptAfter = raceDatabase.transaction(async (tx) => {
		const result = await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`);
		accepterPid.resolve(result.rows[0]!.pid);
		return acceptMembershipInvitation(tx, carol.authority, deniedInvitation.id, 1);
	});
	const deniedAccept = assert.rejects(acceptAfter);
	try {
		await waitForBlocked(await accepterPid.promise, await revokedBeforeAcceptance.promise);
	} finally {
		releaseRevocation.resolve();
	}
	await Promise.all([revokeFirst, deniedAccept]);
	assertions++;
	check(
		(
			await database
				.select()
				.from(organizationMembership)
				.where(
					and(
						eq(organizationMembership.organizationEntityId, organization.entityId),
						eq(organizationMembership.memberAuthUserId, carol.account.id),
					),
				)
		).length,
		0,
		"A revoked invitation source cannot create membership after waiting",
	);
	check(
		MembershipInvitationPageSchema.parse(
			await request("GET", `${prefix}/me/invitations`, undefined, 200, carol),
		).items.find((item) => item.id === deniedInvitation.id)?.state,
		"invalidated",
		"The recipient sees revoked-source invitation state",
	);
	await database.transaction((tx) => eraseOwnAccount(tx, owner.authority));
	await drainErasure(owner.account.id);
	check(
		(
			await database
				.select()
				.from(organizationMembership)
				.where(
					and(
						eq(organizationMembership.organizationEntityId, organization.entityId),
						eq(organizationMembership.memberAuthUserId, bob.account.id),
					),
				)
		)[0]?.removedAt,
		null,
		"Erasing an inviter preserves a different person's accepted membership",
	);
	check(
		(
			await database
				.select()
				.from(organizationMembershipInvitation)
				.where(
					and(
						eq(organizationMembershipInvitation.invitedByAuthUserId, owner.account.id),
						eq(organizationMembershipInvitation.state, "pending"),
					),
				)
		).length,
		0,
		"Sender erasure drains pending invitation state",
	);
	await database.transaction((tx) => eraseOwnAccount(tx, alice.authority));
	await drainErasure(alice.account.id);
	check(
		(
			await database
				.select()
				.from(organizationMembership)
				.where(eq(organizationMembership.memberAuthUserId, alice.account.id))
		).length,
		0,
		"Own erasure removes inactive roster rows",
	);
	check(
		(
			await database
				.select()
				.from(organizationMembershipEvent)
				.where(eq(organizationMembershipEvent.memberAuthUserId, alice.account.id))
		).length,
		0,
		"Own erasure removes membership transition history",
	);
	check(
		(
			await database
				.select()
				.from(organizationMembershipInvitation)
				.where(eq(organizationMembershipInvitation.recipientAuthUserId, alice.account.id))
		).length,
		0,
		"Own erasure removes received invitations after dependent history",
	);
	const repository = new URL("../../../", import.meta.url);
	const sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/Taskfile.yml",
		"services/main/scripts/check-organization-membership.ts",
		"services/main/src/services/participation/membership.ts",
		"services/main/src/services/participation/membership-contracts.ts",
		"services/main/src/services/participation/commands.ts",
		"services/main/src/services/participation/policy.ts",
		"services/main/src/services/participation/organizations.ts",
		"services/main/src/services/participation/erasure.ts",
		"services/main/src/services/api/participation/membership.ts",
		"services/main/src/services/auth/entity.ts",
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
			check: "organization-membership",
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(repository),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			platform: `${process.platform}/${process.arch}`,
			runtime: runtime.rows[0],
			assertions,
			signedSessionHttp: true,
			crossConnectionRevocationRaces: true,
			noEmailOrMessageDelivery: true,
			disposablePublicAuditFixtures: fixtureAccounts.length,
		}),
	);
} catch (cause) {
	let detail: unknown = cause;
	while (detail instanceof Error && detail.cause) detail = detail.cause;
	console.error(detail);
	process.exitCode = 1;
} finally {
	for (const account of fixtureAccounts) {
		try {
			const [stored] = await database
				.select({ erasedAt: users.erasedAt })
				.from(users)
				.where(eq(users.id, account.id));
			if (stored && !stored.erasedAt)
				await database.transaction((tx) => eraseOwnAccount(tx, account.authority));
			if (stored) await drainErasure(account.id);
		} catch (cause) {
			console.error(
				"Disposable membership fixture private cleanup failed",
				cause instanceof Error ? cause.message.slice(0, 300) : cause,
			);
			process.exitCode = 1;
		}
	}
	if (fixtureAccounts.length)
		await database.delete(sessions).where(
			inArray(
				sessions.userId,
				fixtureAccounts.map((account) => account.id),
			),
		);
	await racePool.end();
	await database.$client.end();
	await observability.shutdown();
}
