import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { z } from "zod";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { database, type DatabaseTransaction } from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import { accountErasure } from "@rezics/schema/postgres/access/participation";
import {
	accessMembership,
	accessMembershipEvent,
} from "@rezics/schema/postgres/access/access-membership";
import {
	organizationEnrollmentInvitation,
	organizationEnrollmentReview,
} from "@rezics/schema/postgres/access/organization-membership";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import { allocateAccessSubject } from "../src/services/authorization/identities";
import { applyAccessMembershipCommand } from "../src/services/authorization/memberships";
import { applyAccessRepresentationCommand } from "../src/services/authorization/representations";
import { ManagementAuthorityDenied } from "../src/services/authorization/management-authority";
import {
	acceptMembershipInvitation,
	listOrganizationMembers,
} from "../src/services/participation/membership";
import {
	MembershipInvitationPageSchema,
	MembershipReceiptSchema,
	OrganizationMemberPageSchema,
	MembershipRecipientSchema,
	MembershipContactSchema,
	MembershipHistorySchema,
} from "../src/services/participation/membership-contracts";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
	fixtureMembershipManager,
} from "./native-enrollment-fixture";

assertNativeEnrollmentFixture();
const observability = initializeObservability({
	service: { name: "rezics-native-org-membership", version: "1.0.0", environment: "tooling" },
});
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
const { dispatchAccountErasureBatch } = await import("../src/services/participation/erasure");
const { reconcileOrganizationEnrollmentBatch } = await import(
	"../src/services/participation/membership-worker"
);
api.compile();
const authContext = await auth.$context;
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 4,
	statement_timeout: 15000,
});
const peer = drizzle({ client: pool });
const prefix = "/participation/membership";
let assertions = 0,
	httpChecks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	assertions++;
}
type HttpActor = { cookie: string; context: PrincipalRequestContext };
async function request(
	method: string,
	path: string,
	status: number,
	person?: HttpActor,
	body?: unknown,
): Promise<unknown> {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers: {
				...(person
					? {
							Cookie: person.cookie,
							"X-Rezics-Authority": JSON.stringify(person.context.selection),
						}
					: {}),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, status, `${method} ${path}: ${text.slice(0, 1600)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
async function actor(name: string) {
	const [account] = await database
		.insert(users)
		.values({
			name: `Private ${name}`,
			email: `${randomUUID()}@org-fixture.invalid`,
			emailVerified: true,
		})
		.returning();
	assert.ok(account);
	const session = await authContext.internalAdapter.createSession(account.id),
		directContext = fixturePrincipalContext(session);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	const identity = z
		.object({
			entityId: z.uuid(),
			representation: z.object({ id: z.uuid(), revision: z.number() }),
		})
		.parse(
			await request(
				"POST",
				"/account/identities",
				200,
				{ cookie, context: directContext },
				{
					operationId: randomUUID(),
					names: [{ language: "en", value: name }],
					main: { expectedVersion: 0 },
				},
			),
		);
	const context = new PrincipalRequestContext(
		account.id,
		{
			mode: "represented",
			entityId: identity.entityId,
			representations: [identity.representation],
		},
		directContext.credentialProof(),
	);
	return { account, session, cookie, context, directContext, identity };
}
type Actor = Awaited<ReturnType<typeof actor>>;
const direct = (person: Actor): HttpActor => ({
	cookie: person.cookie,
	context: person.directContext,
});
const entityRecipient = (person: Actor) => ({
	kind: "entity" as const,
	entityId: person.identity.entityId,
});
type Recipient = z.infer<typeof MembershipRecipientSchema>;
async function organization(owner: Actor) {
	const result = z
		.strictObject({
			entityId: z.uuid(),
			scopeId: z.uuid(),
			representation: z.strictObject({ id: z.uuid(), revision: z.number().int() }),
		})
		.parse(
			await request("POST", `${prefix}/organizations`, 200, direct(owner), {
				name: "Native fixture organization",
				language: "en",
			}),
		);
	return {
		...result,
		manager: {
			cookie: owner.cookie,
			context: new PrincipalRequestContext(
				owner.account.id,
				{
					mode: "represented",
					entityId: result.entityId,
					representations: [result.representation],
				},
				owner.directContext.credentialProof(),
			),
		},
	};
}
type Org = Awaited<ReturnType<typeof organization>>;
const invitationReceipt = MembershipReceiptSchema.extend({
	invitationId: z.uuid(),
	revision: z.number().int().positive(),
	state: z.literal("pending"),
});
async function invite(manager: HttpActor, org: Org, recipient: Recipient, expiresAt?: string) {
	const body = { recipient, operationId: randomUUID(), ...(expiresAt ? { expiresAt } : {}) };
	const receipt = invitationReceipt.parse(
		await request(
			"POST",
			`${prefix}/organizations/${org.entityId}/invitations`,
			200,
			manager,
			body,
		),
	);
	return { body, receipt };
}
async function incoming(person: HttpActor) {
	return MembershipInvitationPageSchema.parse(
		await request("GET", `${prefix}/me/invitations`, 200, person),
	);
}
async function accept(person: HttpActor, invitationId: string) {
	const item = (await incoming(person)).items.find((item) => item.id === invitationId);
	assert.ok(item);
	const body = {
		operationId: randomUUID(),
		expectedRevision: item.revision,
		expectedMembershipVersion: item.membershipVersion,
		consent: true as const,
	};
	return {
		body,
		receipt: MembershipReceiptSchema.parse(
			await request("POST", `${prefix}/invitations/${invitationId}/accept`, 200, person, body),
		),
	};
}
async function roster(manager: HttpActor, org: Org) {
	return OrganizationMemberPageSchema.parse(
		await request("GET", `${prefix}/organizations/${org.entityId}/members`, 200, manager),
	);
}
async function subject(person: Actor, kind: "entity" | "principal" = "entity") {
	return database.transaction((tx) =>
		allocateAccessSubject(tx, {
			kind,
			id: kind === "entity" ? person.identity.entityId : person.account.id,
		}),
	);
}
async function member(org: Org, subjectId: string) {
	return (
		await database
			.select()
			.from(accessMembership)
			.where(
				and(eq(accessMembership.scopeId, org.scopeId), eq(accessMembership.subjectId, subjectId)),
			)
	)[0];
}
async function drain(id: string) {
	for (let step = 0; step < 150; step++) {
		await database
			.update(accountErasure)
			.set({ availableAt: new Date(0) })
			.where(eq(accountErasure.authUserId, id));
		const count = await dispatchAccountErasureBatch({ authUserId: id });
		assert.ok(count <= 500);
		assertions++;
		if (
			(await database.select().from(accountErasure).where(eq(accountErasure.authUserId, id)))[0]
				?.stage === "complete"
		)
			return;
	}
	throw new Error("Org erasure failed to finish bounded worker stages");
}
async function blocked(pid: number, by: number) {
	const end = Date.now() + 5000;
	while (Date.now() < end) {
		if (
			(
				await pool.query<{ blocked: boolean }>(
					"select $2::integer=any(pg_blocking_pids($1)) as blocked",
					[pid, by],
				)
			).rows[0]?.blocked
		) {
			assertions++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("Expected original invitation authority contention");
}
async function race<T>(
	writer: (tx: DatabaseTransaction) => Promise<unknown>,
	reader: (tx: DatabaseTransaction) => Promise<T>,
	observe: (promise: Promise<T>) => Promise<unknown>,
) {
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const writing = peer.transaction(async (tx) => {
		await writer(tx);
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void writing.catch(held.reject);
	const holder = await held.promise;
	const reading = peer.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return reader(tx);
	});
	void reading.catch(started.reject);
	const observed = observe(reading);
	void observed.catch(() => {});
	try {
		await blocked(await started.promise, holder);
	} finally {
		release.resolve();
		await writing;
		await observed;
	}
}
async function revokeControl(tx: DatabaseTransaction, owner: Actor, org: Org) {
	return applyAccessRepresentationCommand(
		tx,
		{
			operation: "revoke",
			entityId: org.entityId,
			grantId: org.representation.id,
			expectedVersion: org.representation.revision,
			operationId: randomUUID(),
			operatorAuthUserId: owner.account.id,
			authoritySubjectId: await allocateAccessSubject(tx, {
				kind: "principal",
				id: owner.account.id,
			}),
		},
		sql<boolean>`true`,
	);
}
try {
	const owner = await actor("Org owner"),
		alice = await actor("Public Alice"),
		bob = await actor("Public Bob"),
		carol = await actor("Public Carol");
	const org = await organization(owner),
		path = `${prefix}/organizations/${org.entityId}`;
	await request("GET", `${path}/members`, 401);
	await request("GET", `${path}/members`, 403, owner);
	await request("GET", `${path}/members`, 403, direct(owner));
	await request("GET", `${path}/members`, 403, bob);
	check(
		(await roster(org.manager, org)).items.length,
		0,
		"Org creation grants explicit control without enrolling its controller",
	);
	const manager = await database.transaction((tx) =>
		fixtureMembershipManager(tx, bob.session, { owner: "entity", id: org.entityId }),
	);
	const directManager = { cookie: bob.cookie, context: manager.context };
	check(
		(await roster(directManager, org)).items.length,
		0,
		"a directly granted native manager is not enrolled either",
	);
	await request("GET", `${path}/members`, 403, bob);
	const directory = z
		.object({ items: z.array(z.object({ entityId: z.uuid() })) })
		.parse(await request("GET", `${prefix}/managed-organizations`, 200, direct(owner)));
	check(
		directory.items.some((row) => row.entityId === org.entityId),
		true,
		"native control is discoverable independently from public Self",
	);
	await request("POST", `${path}/invitations`, 422, org.manager, {
		recipient: entityRecipient(alice),
		recipientAuthUserId: alice.account.id,
		operationId: randomUUID(),
	});
	const invitation = await invite(org.manager, org, entityRecipient(alice));
	check(
		invitationReceipt.parse(
			await request("POST", `${path}/invitations`, 200, org.manager, invitation.body),
		),
		invitation.receipt,
		"retry uses the same immutable operation receipt",
	);
	await request("POST", `${path}/invitations`, 409, org.manager, {
		...invitation.body,
		operationId: randomUUID(),
	});
	check((await incoming(bob)).items.length, 0, "another public subject cannot see the invitation");
	check(
		(await incoming(direct(alice))).items.length,
		0,
		"a principal inbox does not borrow its Entity invitation",
	);
	const inbox = await incoming(alice);
	check(
		inbox.items[0]?.id,
		invitation.receipt.invitationId,
		"the addressed represented Entity sees its invitation",
	);
	check(
		JSON.stringify(inbox).includes(alice.account.id) ||
			JSON.stringify(inbox).includes(owner.account.id),
		false,
		"invitations expose no private operator IDs",
	);
	await request(
		"POST",
		`${prefix}/invitations/${invitation.receipt.invitationId}/accept`,
		404,
		bob,
		{ operationId: randomUUID(), expectedRevision: 1, expectedMembershipVersion: 0, consent: true },
	);
	await request(
		"POST",
		`${prefix}/invitations/${invitation.receipt.invitationId}/accept`,
		422,
		alice,
		{ operationId: randomUUID(), expectedRevision: 1, expectedMembershipVersion: 0 },
	);
	const aliceSubject = await subject(alice),
		bobSubject = await subject(bob);
	await assert.rejects(
		database.transaction((tx) =>
			tx
				.update(organizationEnrollmentInvitation)
				.set({ recipientSubjectId: bobSubject })
				.where(eq(organizationEnrollmentInvitation.id, invitation.receipt.invitationId)),
		),
	);
	assertions++;
	await assert.rejects(
		database.transaction((tx) =>
			tx
				.update(organizationEnrollmentInvitation)
				.set({ state: "accepted", revision: 2, resolvedAt: new Date() })
				.where(eq(organizationEnrollmentInvitation.id, invitation.receipt.invitationId)),
		),
	);
	assertions++;
	await assert.rejects(
		database.transaction((tx) =>
			applyAccessMembershipCommand(
				tx,
				{
					operation: "admit",
					scopeId: org.scopeId,
					subjectId: aliceSubject,
					expectedVersion: 0,
					operationId: randomUUID(),
					operatorAuthUserId: alice.account.id,
					authoritySubjectId: aliceSubject,
				},
				sql<boolean>`true`,
			),
		),
	);
	assertions++;
	const accepted = await accept(alice, invitation.receipt.invitationId);
	check(
		[accepted.receipt.state, accepted.receipt.activeGeneration],
		["accepted", 1],
		"explicit recipient acceptance creates a generation",
	);
	check(
		MembershipReceiptSchema.parse(
			await request(
				"POST",
				`${prefix}/invitations/${invitation.receipt.invitationId}/accept`,
				200,
				alice,
				accepted.body,
			),
		),
		accepted.receipt,
		"acceptance receipt replay creates no duplicate admission",
	);
	await request(
		"POST",
		`${prefix}/invitations/${invitation.receipt.invitationId}/accept`,
		409,
		alice,
		{ ...accepted.body, operationId: randomUUID() },
	);
	await request("GET", `${path}/members`, 403, alice);
	const joined = await roster(org.manager, org);
	check(
		joined.items.map((row) => row.recipient),
		[entityRecipient(alice)],
		"membership grants no manager role or private account identity",
	);
	check(
		joined.items[0]?.memberName,
		"Public Alice",
		"public names are independent from private sign-in labels",
	);
	check(
		JSON.stringify(joined).includes(alice.account.id),
		false,
		"roster metadata excludes private account IDs",
	);
	await request("GET", "/account/main-identity", 403, org.manager);
	for (const person of [alice, owner]) {
		const choice = z.object({ entityId: z.uuid() }).parse(
			await request("GET", "/account/main-identity", 200, {
				cookie: person.cookie, context: person.directContext,
			}),
		);
		check(choice.entityId, person.identity.entityId, "direct private settings retain their account owner");
	}
	await request("POST", `${path}/members/remove`, 409, org.manager, {
		operationId: randomUUID(),
		expectedMembershipVersion: 99,
		recipient: entityRecipient(alice),
	});
	const removed = MembershipReceiptSchema.parse(
		await request("POST", `${path}/members/remove`, 200, org.manager, {
			operationId: randomUUID(),
			expectedMembershipVersion: accepted.receipt.version,
			recipient: entityRecipient(alice),
		}),
	);
	check(removed.activeGeneration, null, "manager removal ends only the active generation");
	const secondInvite = await invite(org.manager, org, entityRecipient(alice));
	const rejoined = await accept(alice, secondInvite.receipt.invitationId);
	check(
		[rejoined.receipt.membershipId, rejoined.receipt.activeGeneration],
		[accepted.receipt.membershipId, 2],
		"rejoin retains identity and allocates a new generation",
	);
	await request("POST", `${prefix}/me/organizations/${org.entityId}/leave`, 200, alice, {
		operationId: randomUUID(),
		expectedMembershipVersion: rejoined.receipt.version,
	});
	const history = MembershipHistorySchema.parse(
		await request("POST", `${path}/history`, 200, org.manager, {
			recipient: entityRecipient(alice),
		}),
	);
	check(
		history.items.map((row) => row.operation).sort(),
		["admit", "admit", "leave", "remove"].sort(),
		"shared admission history retains every transition",
	);
	assert.ok(accepted.receipt.membershipId);
	await assert.rejects(
		database.transaction((tx) =>
			tx
				.delete(accessMembershipEvent)
				.where(eq(accessMembershipEvent.membershipId, accepted.receipt.membershipId!)),
		),
	);
	assertions++;

	const declined = await invite(org.manager, org, entityRecipient(bob));
	await request(
		"POST",
		`${prefix}/invitations/${declined.receipt.invitationId}/decline`,
		200,
		bob,
		{ expectedRevision: 1, operationId: randomUUID() },
	);
	await request("POST", `${prefix}/invitations/${declined.receipt.invitationId}/accept`, 409, bob, {
		expectedRevision: 2,
		expectedMembershipVersion: 0,
		consent: true,
		operationId: randomUUID(),
	});
	const cancelled = await invite(org.manager, org, entityRecipient(carol));
	await request(
		"POST",
		`${path}/invitations/${cancelled.receipt.invitationId}/revoke`,
		403,
		owner,
		{ expectedRevision: 1, operationId: randomUUID() },
	);
	await request(
		"POST",
		`${path}/invitations/${cancelled.receipt.invitationId}/revoke`,
		200,
		org.manager,
		{ expectedRevision: 1, operationId: randomUUID() },
	);
	await request(
		"POST",
		`${prefix}/invitations/${cancelled.receipt.invitationId}/accept`,
		409,
		carol,
		{ expectedRevision: 2, expectedMembershipVersion: 0, consent: true, operationId: randomUUID() },
	);
	const expiring = await invite(
		org.manager,
		org,
		entityRecipient(bob),
		new Date(Date.now() + 1500).toISOString(),
	);
	await setTimeout(1600);
	await request("POST", `${prefix}/invitations/${expiring.receipt.invitationId}/accept`, 403, bob, {
		expectedRevision: 1,
		expectedMembershipVersion: 0,
		consent: true,
		operationId: randomUUID(),
	});
	const replacement = await invite(org.manager, org, entityRecipient(bob));
	check(
		replacement.receipt.invitationId === expiring.receipt.invitationId,
		false,
		"expired identities are never reopened",
	);
	check(
		(
			await database
				.select()
				.from(organizationEnrollmentInvitation)
				.where(eq(organizationEnrollmentInvitation.id, expiring.receipt.invitationId))
		)[0]?.state,
		"expired",
		"bounded reissue reclaims expired pending state",
	);

	// Private principal enrollment requires explicit scoped contact, not an inferred public Entity link.
	const privateAlice = direct(alice);
	const contact = MembershipContactSchema.parse(
		await request("POST", `${path}/contacts`, 200, privateAlice),
	);
	const resolved = z
		.object({ recipient: MembershipRecipientSchema })
		.parse(
			await request("POST", `${path}/recipients`, 200, org.manager, { contact: contact.contact }),
		);
	check(resolved.recipient.kind, "principal", "private contact yields a manager-scoped selector");
	check(
		JSON.stringify(resolved).includes(alice.account.id),
		false,
		"selector disclosure does not reveal the Auth key",
	);
	const privateInvite = await invite(org.manager, org, resolved.recipient);
	await request("POST", `${prefix}/contacts/${contact.id}/revoke`, 200, privateAlice);
	await request(
		"POST",
		`${prefix}/invitations/${privateInvite.receipt.invitationId}/accept`,
		403,
		privateAlice,
		{ expectedRevision: 1, expectedMembershipVersion: 0, consent: true, operationId: randomUUID() },
	);
	await request(
		"POST",
		`${path}/invitations/${privateInvite.receipt.invitationId}/revoke`,
		200,
		org.manager,
		{ expectedRevision: 1, operationId: randomUUID() },
	);
	const newContact = MembershipContactSchema.parse(
		await request("POST", `${path}/contacts`, 200, privateAlice),
	);
	const newRecipient = z.object({ recipient: MembershipRecipientSchema }).parse(
		await request("POST", `${path}/recipients`, 200, org.manager, {
			contact: newContact.contact,
		}),
	);
	const privateAccepted = await accept(
		privateAlice,
		(await invite(org.manager, org, newRecipient.recipient)).receipt.invitationId,
	);
	check(
		privateAccepted.receipt.activeGeneration,
		1,
		"private principal and public Entity have distinct admissions",
	);

	const acceptingBody = {
		operationId: randomUUID(),
		expectedRevision: replacement.receipt.revision,
		expectedMembershipVersion: 0,
		consent: true as const,
	};
	await race(
		(tx) =>
			acceptMembershipInvitation(tx, bob.context, replacement.receipt.invitationId, acceptingBody),
		(tx) => revokeControl(tx, owner, org),
		async (result) => {
			await result;
			assertions++;
		},
	);
	check(
		(await member(org, bobSubject))?.activeGeneration,
		1,
		"accepted institutional membership survives later issuer revocation",
	);
	const staleOrg = await organization(owner);
	const staleInvitation = await invite(staleOrg.manager, staleOrg, entityRecipient(carol));
	await race(
		(tx) => revokeControl(tx, owner, staleOrg),
		(tx) =>
			acceptMembershipInvitation(tx, carol.context, staleInvitation.receipt.invitationId, {
				operationId: randomUUID(),
				expectedRevision: 1,
				expectedMembershipVersion: 0,
				consent: true,
			}),
		(result) => assert.rejects(result, ManagementAuthorityDenied),
	);
	assertions++;
	check(
		(await member(staleOrg, await subject(carol)))?.activeGeneration ?? null,
		null,
		"revoked original invitation authority cannot admit after waiting",
	);
	const staleItem = (await incoming(carol)).items.find(
		(row) => row.id === staleInvitation.receipt.invitationId,
	);
	check(
		staleItem?.availability,
		"deny",
		"unusable original authority remains explicitly denied for acceptance",
	);
	await database
		.update(organizationEnrollmentReview)
		.set({ dueAt: new Date(0) })
		.where(eq(organizationEnrollmentReview.invitationId, staleInvitation.receipt.invitationId));
	await reconcileOrganizationEnrollmentBatch();
	check(
		(await incoming(carol)).items.find((row) => row.id === staleInvitation.receipt.invitationId)
			?.state,
		"invalidated",
		"bounded reconciliation records the terminal invalidation without granting membership",
	);

	// Erasure affects private subjects and evidence, not another person's accepted Entity admission.
	const liveOrg = await organization(owner);
	await accept(
		bob,
		(await invite(liveOrg.manager, liveOrg, entityRecipient(bob))).receipt.invitationId,
	);
	await invite(liveOrg.manager, liveOrg, entityRecipient(carol));
	await request("POST", "/participation/account/erase", 200, direct(owner));
	await drain(owner.account.id);
	check(
		(await member(liveOrg, bobSubject))?.activeGeneration,
		1,
		"inviter erasure preserves an accepted public Entity admission",
	);
	check(
		(
			await database
				.select()
				.from(organizationEnrollmentInvitation)
				.where(
					and(
						eq(organizationEnrollmentInvitation.invitedByAuthUserId, owner.account.id),
						eq(organizationEnrollmentInvitation.state, "pending"),
					),
				)
		).length,
		0,
		"erasure drains the inviter's pending authority evidence",
	);
	const privateSubject = await subject(alice, "principal");
	await request("POST", "/participation/account/erase", 200, direct(alice));
	await drain(alice.account.id);
	check(
		(await member(org, privateSubject))?.activeGeneration,
		null,
		"private principal erasure ends private membership",
	);
	check(
		(
			await database
				.select()
				.from(organizationEnrollmentInvitation)
				.where(eq(organizationEnrollmentInvitation.recipientSubjectId, privateSubject))
		).every((row) => row.authority === null),
		true,
		"private recipient erasure clears credential evidence while retaining minimal native anchors",
	);
	check(
		(await member(org, aliceSubject))?.activeGeneration,
		null,
		"the earlier public departure remains ended without resurrecting a generation",
	);

	// Direct manager proof is still current independently from the erased original controller.
	check(
		(
			await database.transaction((tx) =>
				listOrganizationMembers(tx, manager.context, org.entityId, {}),
			)
		).items.some(
			(row) => row.recipient.kind === "entity" && row.recipient.entityId === bob.identity.entityId,
		),
		true,
		"institutional direct management does not depend on the original creator's account",
	);
	const root = new URL("../../../", import.meta.url),
		sources: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-organization-membership.ts",
		"services/main/scripts/native-enrollment-fixture.ts",
		"services/main/src/services/participation/membership.ts",
		"services/main/src/services/participation/membership-worker.ts",
		"services/main/src/services/participation/organization-control.ts",
		"services/main/src/services/participation/erasure.ts",
		"services/main/src/services/api/participation/membership.ts",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sources[path] = createHash("sha256")
			.update(await readFile(new URL(path, root)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(root),
				encoding: "utf8",
			}).trim(),
			sources,
			assertions,
			httpChecks,
			node: process.version,
			scope:
				"Native Org creation/control, public/private consent, stable admissions/receipts, original-source revocation races and account erasure; direct fixture manager grants use SQL-admin setup",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
	await observability.shutdown();
}
