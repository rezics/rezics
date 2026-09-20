import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { serializeSignedCookie } from "better-call";
import { z } from "zod";
import { initializeObservability } from "@rezics/observability";
import { database, type DatabaseTransaction } from "../src/services/database";
import {
	users,
	sessions,
	unitOwnership,
	realm,
	realmMember,
	realmRuleRevision,
	realmRuleAcceptance,
	unitFollow,
} from "../src/services/database/schema";
import { referenceValueIdForNativeId } from "../src/services/units/reference-value";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import { allocateAccessSubject } from "../src/services/authorization/identities";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { AccessChanged, AccessDenied } from "../src/services/authorization/http-errors";
import { ManagementAuthorityDenied } from "../src/services/authorization/management-authority";
import { RealmRulesAcceptanceRequired } from "../src/services/authorization/errors";
import { CredentialAuthorityDenied } from "../src/services/auth/credential-authority";
import { applyAccessRepresentationCommand } from "../src/services/authorization/representations";
import { applyAccessRoleBindingCommand } from "../src/services/authorization/role-bindings";
import { joinRealm, leaveRealm, updateRealmMember } from "../src/services/realms/membership";
import { readRealmEnrollment } from "../src/services/realms/roster";
import {
	RealmEnrollmentReceiptSchema,
	RealmEnrollmentStatusSchema,
	JoinRealmSchema,
	RealmEnrollmentCommandSchema,
} from "../src/services/realms/membership-contracts";
import {
	assertNativeEnrollmentFixture,
	fixtureMembershipManager,
	fixturePrincipalContext,
} from "./native-enrollment-fixture";

assertNativeEnrollmentFixture();
const target = new URL(process.env.DATABASE_URL!);
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
const authContext = await auth.$context;
const pool = new Pool({ connectionString: target.toString(), max: 4, statement_timeout: 14000 });
const raceDb = drizzle({ client: pool });
let checks = 0,
	httpChecks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
type HttpActor = { cookie: string; context: PrincipalRequestContext };
async function actor(name: string) {
	const [account] = await database
		.insert(users)
		.values({ name, email: `${randomUUID()}@example.invalid`, emailVerified: true })
		.returning();
	assert.ok(account);
	const session = await authContext.internalAdapter.createSession(account.id);
	const direct = fixturePrincipalContext(session);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	const created = z
		.strictObject({
			operationId: z.uuid(),
			entityId: z.uuid(),
			representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
			mainPreferenceVersion: z.number().int().nullable(),
		})
		.parse(
			await request(
				"POST",
				"/account/identities",
				200,
				{ cookie, context: direct },
				{
					operationId: randomUUID(),
					names: [{ language: "en", value: name }],
					main: { expectedVersion: 0 },
				},
			),
		);
	const context = new PrincipalRequestContext(
		account.id,
		{ mode: "represented", entityId: created.entityId, representations: [created.representation] },
		direct.credentialProof(),
	);
	const principalSubjectId = await database.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: account.id }),
	);
	return {
		account,
		identity: { id: created.entityId },
		session,
		cookie,
		context,
		principalSubjectId,
		grant: { grantId: created.representation.id, version: created.representation.revision },
	};
}
type Actor = Awaited<ReturnType<typeof actor>>;
type Status = z.infer<typeof RealmEnrollmentStatusSchema>;
function expected(status: Status) {
	return {
		operationId: randomUUID(),
		expectedControlRevision: status.controlRevision,
		expectedRevision: status.receipt?.revision ?? 0,
		expectedMembershipVersion: status.receipt?.version ?? 0,
		expectedEnforcementRevision: status.receipt?.enforcementRevision ?? 0,
	};
}
async function request(
	method: string,
	path: string,
	expectedStatus: number,
	person: HttpActor,
	body?: unknown,
): Promise<unknown> {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path.startsWith("/") ? path : `/realms/${path}`}`, {
			method,
			headers: {
				Cookie: person.cookie,
				"X-Rezics-Authority": JSON.stringify(person.context.selection),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 1600)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
async function status(person: HttpActor, realmId: string, recipient?: Actor) {
	return RealmEnrollmentStatusSchema.parse(
		await request(
			recipient ? "POST" : "GET",
			`${realmId}/${recipient ? "members/inspect" : "membership"}`,
			200,
			person,
			recipient ? { kind: "entity", entityId: recipient.identity.id } : undefined,
		),
	);
}
async function join(person: Actor, realmId: string, ruleRevisionId: string | null = null) {
	const body = {
		...expected(await status(person, realmId)),
		consent: true as const,
		ruleRevisionId,
	};
	const receipt = RealmEnrollmentReceiptSchema.parse(
		await request("POST", `${realmId}/membership`, 200, person, body),
	);
	return { body, receipt };
}
async function leave(person: Actor, realmId: string) {
	return RealmEnrollmentReceiptSchema.parse(
		await request(
			"DELETE",
			`${realmId}/membership`,
			200,
			person,
			expected(await status(person, realmId)),
		),
	);
}
async function moderate(
	manager: HttpActor,
	realmId: string,
	recipient: Actor,
	operation: z.infer<typeof RealmEnrollmentCommandSchema>["operation"],
) {
	const body = {
		...expected(await status(manager, realmId, recipient)),
		recipient: { kind: "entity" as const, entityId: recipient.identity.id },
		operation,
	};
	return RealmEnrollmentReceiptSchema.parse(
		await request("PATCH", `${realmId}/members`, 200, manager, body),
	);
}
async function newRealm(owner: Actor, values: Partial<typeof realm.$inferInsert> = {}) {
	return database.transaction(async (tx) => {
		const [row] = await tx
			.insert(realm)
			.values({ status: "published", visibility: "public", publishedAt: new Date(), ...values })
			.returning();
		assert.ok(row);
		await tx.insert(unitOwnership).values({
			unitId: row.id,
			profileId: owner.identity.id,
			assignedByProfileId: owner.identity.id,
		});
		return row;
	});
}
async function follows(person: Actor, realmId: string) {
	return (
		await database
			.select()
			.from(unitFollow)
			.where(
				and(
					eq(unitFollow.targetReferenceId, referenceValueIdForNativeId(realmId)),
					eq(unitFollow.followerProfileId, person.identity.id),
				),
			)
	).length;
}
async function blocked(pid: number, by: number) {
	const deadline = Date.now() + 5000;
	while (Date.now() < deadline) {
		if (
			(
				await pool.query<{ blocked: boolean }>(
					"select $2::integer=any(pg_blocking_pids($1)) as blocked",
					[pid, by],
				)
			).rows[0]?.blocked
		) {
			checks++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("Expected the native Realm authority/admission fence");
}
async function race<Read>(
	writer: (tx: DatabaseTransaction) => Promise<unknown>,
	reader: (tx: DatabaseTransaction) => Promise<Read>,
	observe: (read: Promise<Read>) => Promise<unknown>,
) {
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		waiting = Promise.withResolvers<number>();
	const writing = raceDb.transaction(async (tx) => {
		await writer(tx);
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void writing.catch(held.reject);
	const holder = await held.promise;
	const reading = raceDb.transaction(async (tx) => {
		waiting.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return reader(tx);
	});
	void reading.catch(waiting.reject);
	const observed = observe(reading);
	void observed.catch(() => {});
	try {
		await blocked(await waiting.promise, holder);
	} finally {
		release.resolve();
		await writing;
		await observed;
	}
}
const owner = await actor("Realm owner"),
	member = await actor("Realm member"),
	other = await actor("Other Realm member");
try {
	const open = await newRealm(owner);
	const first = await join(member, open.id);
	check(
		[first.receipt.state, first.receipt.activeGeneration],
		["approved", 1],
		"open admission creates the first real generation",
	);
	check(
		RealmEnrollmentReceiptSchema.parse(
			await request("POST", `${open.id}/membership`, 200, member, first.body),
		),
		first.receipt,
		"same operation replays its original receipt",
	);
	await request("POST", `${open.id}/membership`, 409, member, {
		...first.body,
		operationId: randomUUID(),
	});
	check(await follows(member, open.id), 1, "public Entity admission creates one follow");
	const departed = await leave(member, open.id);
	check(
		[departed.state, departed.activeGeneration],
		["left", null],
		"departure ends the generation without deleting history",
	);
	check(await follows(member, open.id), 0, "departure removes the follow");
	check(
		(await join(member, open.id)).receipt.activeGeneration,
		2,
		"rejoin allocates a new admission generation",
	);
	const muted = await moderate(owner, open.id, member, "mute");
	check(muted.enforcement, "muted", "manager applies independent enforcement");
	check((await leave(member, open.id)).enforcement, "muted", "departure retains the mute");
	check((await join(member, open.id)).receipt.enforcement, "muted", "rejoin cannot clear a mute");
	await moderate(owner, open.id, member, "clear");
	await moderate(owner, open.id, member, "remove");
	check((await join(member, open.id)).receipt.state, "approved", "removal is not a permanent ban");
	await moderate(owner, open.id, member, "ban");
	const banned = await status(member, open.id);
	await request("POST", `${open.id}/membership`, 403, member, {
		...expected(banned),
		consent: true,
		ruleRevisionId: null,
	});
	check(
		(await status(member, open.id)).receipt?.enforcement,
		"banned",
		"denied rejoin cannot alter enforcement",
	);
	const bannedDeparture = await leave(member, open.id);
	check(
		[bannedDeparture.activeGeneration, bannedDeparture.enforcement],
		[null, "banned"],
		"a banned member can leave without clearing enforcement",
	);
	await request("POST", `${open.id}/membership`, 403, member, {
		...expected(await status(member, open.id)),
		consent: true,
		ruleRevisionId: null,
	});
	const cleared = await moderate(owner, open.id, member, "clear");
	check(cleared.activeGeneration, null, "clearing a ban does not reenroll a departed subject");

	const privateAccount = await actor("Private Realm participant");
	const privateMember = {
		...privateAccount,
		context: fixturePrincipalContext(privateAccount.session),
	};
	const privateRealm = await newRealm(owner);
	await join(privateMember, privateRealm.id);
	const privateStatus = await status(privateMember, privateRealm.id);
	check(
		privateStatus.recipient.kind,
		"principal",
		"direct consent enrolls the private principal rather than its public Entity",
	);
	check(
		JSON.stringify(privateStatus).includes(privateMember.account.id),
		false,
		"private enrollment DTOs use scoped selectors instead of account IDs",
	);
	check(
		await follows(privateMember, privateRealm.id),
		0,
		"private enrollment creates no public Entity follow",
	);
	const publicRoster = await request("GET", `${privateRealm.id}/members`, 200, owner);
	check(
		z.object({ items: z.array(z.unknown()) }).parse(publicRoster).items.length,
		0,
		"private principal enrollment is absent from the public Entity roster",
	);
	await leave(privateMember, privateRealm.id);

	const invitationRealm = await newRealm(owner, { visibility: "private", joinPolicy: "approval" });
	const contactSchema = z.strictObject({
		id: z.uuid(),
		revision: z.number().int(),
		contact: z.string(),
		expiresAt: z.iso.datetime(),
	});
	const recipientSchema = z.discriminatedUnion("kind", [
		z.strictObject({ kind: z.literal("entity"), entityId: z.uuid() }),
		z.strictObject({ kind: z.literal("principal"), selector: z.string() }),
	]);
	const resolvedSchema = z.strictObject({ contactId: z.uuid(), recipient: recipientSchema });
	await request("GET", `${invitationRealm.id}/membership`, 404, privateMember);
	// A private recipient can consent to contact without learning whether the named Realm exists.
	contactSchema.parse(
		await request("POST", `${randomUUID()}/enrollment-contact`, 200, privateMember),
	);
	const contact = contactSchema.parse(
		await request("POST", `${invitationRealm.id}/enrollment-contact`, 200, privateMember),
	);
	const resolved = resolvedSchema.parse(
		await request("POST", `${invitationRealm.id}/enrollment-contacts/resolve`, 200, owner, {
			contact: contact.contact,
		}),
	);
	check(
		resolved.recipient.kind,
		"principal",
		"contact resolution yields a private scoped selector",
	);
	check(
		JSON.stringify(resolved).includes(privateMember.account.id),
		false,
		"manager contact resolution never returns the account ID",
	);
	const beforeInvite = RealmEnrollmentStatusSchema.parse(
		await request("POST", `${invitationRealm.id}/members/inspect`, 200, owner, resolved.recipient),
	);
	const invited = RealmEnrollmentReceiptSchema.parse(
		await request("PATCH", `${invitationRealm.id}/members`, 200, owner, {
			...expected(beforeInvite),
			recipient: resolved.recipient,
			contactId: resolved.contactId,
			operation: "invite",
		}),
	);
	check(
		[invited.state, invited.activeGeneration],
		["invited", null],
		"an invitation is not recipient consent or admission",
	);
	await request("GET", `${invitationRealm.id}/enrollment-rules`, 200, privateMember);
	const awaitingConsent = await status(privateMember, invitationRealm.id);
	await request("DELETE", `enrollment-contacts/${contact.id}`, 200, privateMember, {
		expectedRevision: contact.revision,
	});
	await request("POST", `${invitationRealm.id}/membership`, 403, privateMember, {
		...expected(awaitingConsent),
		consent: true,
		ruleRevisionId: null,
	});
	const renewedContact = contactSchema.parse(
		await request("POST", `${invitationRealm.id}/enrollment-contact`, 200, privateMember),
	);
	const renewedRecipient = resolvedSchema.parse(
		await request("POST", `${invitationRealm.id}/enrollment-contacts/resolve`, 200, owner, {
			contact: renewedContact.contact,
		}),
	);
	const reinviteStatus = RealmEnrollmentStatusSchema.parse(
		await request(
			"POST",
			`${invitationRealm.id}/members/inspect`,
			200,
			owner,
			renewedRecipient.recipient,
		),
	);
	await request("PATCH", `${invitationRealm.id}/members`, 200, owner, {
		...expected(reinviteStatus),
		recipient: renewedRecipient.recipient,
		contactId: renewedRecipient.contactId,
		operation: "invite",
	});
	check(
		(await join(privateMember, invitationRealm.id)).receipt.activeGeneration,
		1,
		"fresh contact plus explicit consent admits the private invitee under approval policy",
	);
	await leave(privateMember, invitationRealm.id);

	const approval = await newRealm(owner, { joinPolicy: "approval" });
	const pending = await join(other, approval.id);
	check(
		[pending.receipt.state, pending.receipt.activeGeneration],
		["pending", null],
		"an application grants no membership",
	);
	check(
		await follows(other, approval.id),
		1,
		"an applicant follow remains independent from pending admission",
	);
	const accepted = await moderate(owner, approval.id, other, "approve");
	check(accepted.activeGeneration, 1, "approval activates the captured consent");
	await request("POST", `${approval.id}/membership`, 409, other, {
		...expected(await status(other, approval.id)),
		consent: true,
		ruleRevisionId: null,
	});
	check(
		(await status(other, approval.id)).receipt?.activeGeneration,
		1,
		"another join attempt cannot demote an accepted member",
	);

	for (const values of [
		{ visibility: "private" },
		{ status: "draft" },
		{ createdAt: new Date(Date.now() - 1000), deletedAt: new Date() },
		{ moderationStatus: "removed" },
	] satisfies Partial<typeof realm.$inferInsert>[]) {
		const hidden = await newRealm(owner, values);
		await request("GET", `${hidden.id}/membership`, 404, member);
		await request("POST", `${hidden.id}/membership`, 403, member, {
			operationId: randomUUID(),
			expectedControlRevision: hidden.membershipControlRevision,
			expectedRevision: 0,
			expectedMembershipVersion: 0,
			expectedEnforcementRevision: 0,
			consent: true,
			ruleRevisionId: null,
		});
	}
	for (const mode of ["explicit", "implicit_on_follow"] as const) {
		const subject = await newRealm(owner);
		const [rules] = await database
			.insert(realmRuleRevision)
			.values({
				realmId: subject.id,
				version: 1,
				requireOnJoin: true,
				acknowledgementMode: mode,
				createdByProfileId: owner.identity.id,
			})
			.returning();
		assert.ok(rules);
		const unaccepted = await status(other, subject.id);
		await request("POST", `${subject.id}/membership`, 409, other, {
			...expected(unaccepted),
			consent: true,
			ruleRevisionId: null,
		});
		await request("POST", `${subject.id}/membership`, 422, other, {
			...expected(unaccepted),
			ruleRevisionId: rules.id,
		});
		const acknowledged = RealmEnrollmentReceiptSchema.parse(
			await request("PUT", `${subject.id}/rules/${rules.id}/acknowledgement`, 200, other, {
				...expected(unaccepted),
				consent: true,
				language: "en",
			}),
		);
		check(acknowledged.activeGeneration, null, "acknowledgement alone grants no admission");
		await join(other, subject.id, rules.id);
		check(
			(
				await database
					.select()
					.from(realmRuleAcceptance)
					.where(
						and(
							eq(realmRuleAcceptance.revisionId, rules.id),
							eq(realmRuleAcceptance.profileId, other.identity.id),
						),
					)
			).length,
			1,
			"exact current generation owns its rule consent even for legacy follow policy metadata",
		);
	}

	const managed = await newRealm(owner),
		moderator = await actor("Direct membership moderator");
	await join(owner, managed.id);
	await join(other, managed.id);
	await request(
		"DELETE",
		`${managed.id}/membership`,
		403,
		owner,
		expected(await status(owner, managed.id)),
	);
	const moderatorGrant = await database.transaction((tx) =>
		fixtureMembershipManager(tx, moderator.session, { owner: "realm", id: managed.id }),
	);
	const directModerator = { ...moderator, context: moderatorGrant.context };
	const inspected = await status(owner, managed.id, other);
	await request("PATCH", `${managed.id}/members`, 403, moderator, {
		...expected(inspected),
		recipient: { kind: "entity", entityId: other.identity.id },
		operation: "mute",
	});
	check(
		(await moderate(directModerator, managed.id, other, "mute")).enforcement,
		"muted",
		"direct principal rights require the direct selection",
	);
	await request("PATCH", `${managed.id}/members`, 403, directModerator, {
		...expected(await status(directModerator, managed.id, owner)),
		recipient: { kind: "entity", entityId: owner.identity.id },
		operation: "ban",
	});
	check(
		(await moderate(directModerator, managed.id, other, "clear")).enforcement,
		"clear",
		"authorized moderation clears the mute without replacing membership",
	);

	for (const change of ["approval", "ban", "new-ban", "rules"] as const) {
		const subject = await newRealm(owner),
			guest = await actor(`Waiting ${change}`);
		if (change === "ban") {
			await join(guest, subject.id);
			await leave(guest, subject.id);
		}
		const before = await status(guest, subject.id);
		const body: z.infer<typeof JoinRealmSchema> = {
			...expected(before),
			consent: true,
			ruleRevisionId: null,
		};
		const managerState = await status(owner, subject.id, guest);
		await race(
			async (tx) => {
				if (change === "ban" || change === "new-ban")
					await updateRealmMember(tx, owner.context, subject.id, {
						...expected(managerState),
						recipient: { kind: "entity", entityId: guest.identity.id },
						operation: "ban",
					});
				else {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${subject.id}::text,0))`,
					);
					if (change === "approval")
						await tx.update(realm).set({ joinPolicy: "approval" }).where(eq(realm.id, subject.id));
					else
						await tx.insert(realmRuleRevision).values({
							realmId: subject.id,
							version: 1,
							requireOnJoin: true,
							createdByProfileId: owner.identity.id,
						});
				}
			},
			(tx) => joinRealm(tx, guest.context, subject.id, body),
			(result) =>
				assert.rejects(
					result,
					change === "approval"
						? AccessChanged
						: change === "rules"
							? RealmRulesAcceptanceRequired
							: AccessDenied,
				),
		);
		checks++;
		check(
			await follows(guest, subject.id),
			0,
			"a changed/denied waiting request creates no follow",
		);
		if (change === "approval")
			check(
				(await join(guest, subject.id)).receipt.state,
				"pending",
				"an explicit fresh retry observes the new approval policy",
			);
	}
	const winnerRealm = await newRealm(owner),
		winner = await actor("Winning admission");
	const winningBody = {
		...expected(await status(winner, winnerRealm.id)),
		consent: true as const,
		ruleRevisionId: null,
	};
	await race(
		(tx) => joinRealm(tx, winner.context, winnerRealm.id, winningBody),
		async (tx) => {
			const current = await readRealmEnrollment(tx, owner.context, winnerRealm.id, {
				kind: "entity",
				entityId: winner.identity.id,
			});
			return updateRealmMember(tx, owner.context, winnerRealm.id, {
				...expected(current),
				recipient: { kind: "entity", entityId: winner.identity.id },
				operation: "ban",
			});
		},
		async (result) =>
			check(
				(await result).enforcement,
				"banned",
				"later moderation observes the committed admission and retains its final state",
			),
	);

	const modState = await status(directModerator, managed.id, other);
	await race(
		(tx) =>
			applyAccessRoleBindingCommand(
				tx,
				{
					operation: "revoke",
					targetScopeId: moderatorGrant.scopeId,
					bindingId: moderatorGrant.binding.bindingId,
					expectedVersion: moderatorGrant.binding.version,
					operationId: randomUUID(),
					...moderatorGrant.actor,
				},
				sql<boolean>`true`,
			),
		(tx) =>
			updateRealmMember(tx, directModerator.context, managed.id, {
				...expected(modState),
				recipient: { kind: "entity", entityId: other.identity.id },
				operation: "ban",
			}),
		(result) => assert.rejects(result, ManagementAuthorityDenied),
	);
	checks++;
	check(
		(await status(owner, managed.id, other)).receipt?.enforcement,
		"clear",
		"revoked direct moderator writes no enforcement state",
	);

	const transferRealm = await newRealm(owner),
		recipient = await actor("New owner");
	await join(recipient, transferRealm.id);
	const beforeTransfer = expected(await status(recipient, transferRealm.id));
	await race(
		async (tx) => {
			await lockUnitAccessState(tx, [transferRealm.id]);
			await tx
				.update(unitOwnership)
				.set({ revokedAt: new Date(), revokedByProfileId: owner.identity.id })
				.where(
					and(eq(unitOwnership.unitId, transferRealm.id), sql`${unitOwnership.revokedAt} is null`),
				);
			await tx.insert(unitOwnership).values({
				unitId: transferRealm.id,
				profileId: recipient.identity.id,
				assignedByProfileId: owner.identity.id,
			});
		},
		(tx) => leaveRealm(tx, recipient.context, transferRealm.id, beforeTransfer),
		(result) => assert.rejects(result, AccessDenied),
	);
	checks++;
	check(
		(await status(recipient, transferRealm.id)).receipt?.activeGeneration,
		1,
		"a newly assigned owner cannot depart",
	);

	const stale = await actor("Revoked representation"),
		staleRealm = await newRealm(owner);
	const staleBody = {
		...expected(await status(stale, staleRealm.id)),
		consent: true as const,
		ruleRevisionId: null,
	};
	await database.transaction((tx) =>
		applyAccessRepresentationCommand(
			tx,
			{
				operation: "revoke",
				entityId: stale.identity.id,
				grantId: stale.grant.grantId,
				expectedVersion: stale.grant.version,
				operationId: randomUUID(),
				operatorAuthUserId: stale.account.id,
				authoritySubjectId: stale.principalSubjectId,
			},
			sql<boolean>`true`,
		),
	);
	await assert.rejects(
		raceDb.transaction((tx) => joinRealm(tx, stale.context, staleRealm.id, staleBody)),
		ManagementAuthorityDenied,
	);
	checks++;
	const expired = await actor("Expired session"),
		expiredRealm = await newRealm(owner);
	const expiredBody = {
		...expected(await status(expired, expiredRealm.id)),
		consent: true as const,
		ruleRevisionId: null,
	};
	await database
		.update(sessions)
		.set({ expiresAt: new Date(0) })
		.where(eq(sessions.id, expired.session.id));
	await assert.rejects(
		raceDb.transaction((tx) => joinRealm(tx, expired.context, expiredRealm.id, expiredBody)),
		CredentialAuthorityDenied,
	);
	checks++;

	check(
		(
			await database
				.select()
				.from(realmMember)
				.where(
					and(eq(realmMember.realmId, managed.id), eq(realmMember.profileId, other.identity.id)),
				)
		).length,
		1,
		"native enrollment remains visible through the read-only Entity projection",
	);
} finally {
	await pool.end();
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-realm-membership.ts",
	"services/main/scripts/native-enrollment-fixture.ts",
	"services/main/src/services/realms/membership.ts",
	"services/main/src/services/realms/membership-policy.ts",
	"services/main/src/services/realms/roster.ts",
	"services/main/src/services/api/realms/membership.ts",
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
		checks,
		httpChecks,
		scope:
			"Realm native enrollment/HTTP, explicit consent, generations, enforcement, credential/representation revocation and concurrency; account identities use the native API; direct moderator role/binding setup is SQL-admin",
	}),
);
process.exit(0);
