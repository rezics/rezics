import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { setTimeout } from "node:timers/promises";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { AccessPermissionValues } from "@rezics/access";
import {
	database,
	withDatabaseTransactionContext,
} from "../src/services/database";
import { users } from "@rezics/schema/postgres/identity/auth";
import {
	entityParticipation,
	entityRecoveryEvent,
} from "@rezics/schema/postgres/access/participation";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import {
	organizationEnrollmentInvitation as invitations,
	organizationEnrollmentReview as reviews,
} from "@rezics/schema/postgres/access/organization-membership";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
} from "./native-enrollment-fixture";
import { createAccountIdentity } from "../src/services/authorization/create-account-identity";
import { resolveMainIdentityPreference } from "../src/services/authorization/main-identity";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import { applyAccessRoleCommand } from "../src/services/authorization/roles";
import { applyAccessRoleBindingCommand } from "../src/services/authorization/role-bindings";
import {
	applyAccessRepresentationCommand,
	readAccessRepresentationSnapshot,
} from "../src/services/authorization/representations";
import { AccessDenied } from "../src/services/authorization/http-errors";
import { ManagementAuthorityDenied } from "../src/services/authorization/management-authority";
import {
	createNativeOrganization,
	establishOrganizationEnrollmentControl,
} from "../src/services/participation/organization-control";
import {
	recoverNativeOrganization,
	selectOrganizationRecoveryRecipient,
} from "../src/services/participation/organization-recovery";
import {
	createOrganizationEnrollmentContact,
	inviteOrganizationMember,
	acceptMembershipInvitation,
	listOwnMembershipInvitations,
} from "../src/services/participation/membership";
import { reconcileOrganizationEnrollmentBatch } from "../src/services/participation/membership-worker";

assertNativeEnrollmentFixture();
const observability = initializeObservability({
	service: { name: "rezics-native-org-recovery", version: "1.0.0", environment: "tooling" },
});
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const authContext = await auth.$context;
let checks = 0,
	httpChecks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function actor(name: string) {
	const [account] = await database
		.insert(users)
		.values({
			name: `Private ${name}`,
			email: `${randomUUID()}@recovery.invalid`,
			emailVerified: true,
		})
		.returning();
	assert.ok(account);
	const session = await authContext.internalAdapter.createSession(account.id),
		direct = fixturePrincipalContext(session);
	const identity = await createAccountIdentity(direct, {
		operationId: randomUUID(),
		names: [{ language: "en", value: name }],
		main: { expectedVersion: 0 },
	});
	const principalSubjectId = await database.transaction((tx) =>
		allocateAccessSubject(tx, { kind: "principal", id: account.id }),
	);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	const context = new PrincipalRequestContext(
		account.id,
		{
			mode: "represented",
			entityId: identity.entityId,
			representations: [identity.representation],
		},
		direct.credentialProof(),
	);
	return { account, session, direct, identity, context, principalSubjectId, cookie };
}
type Actor = Awaited<ReturnType<typeof actor>>;
function represented(
	person: Actor,
	entityId: string,
	representation: { id: string; revision: number },
) {
	return new PrincipalRequestContext(
		person.account.id,
		{ mode: "represented", entityId, representations: [representation] },
		person.direct.credentialProof(),
	);
}
async function organization(owner: Actor) {
	const created = await createNativeOrganization(owner.direct, {
		name: "Native recovery Org",
		language: "en",
	});
	return { ...created, manager: represented(owner, created.entityId, created.representation) };
}
type Org = Awaited<ReturnType<typeof organization>>;
async function invite(org: Org, target: Actor, manager = org.manager) {
	const result = await database.transaction((tx) =>
		inviteOrganizationMember(tx, manager, org.entityId, {
			operationId: randomUUID(),
			recipient: { kind: "entity", entityId: target.identity.entityId },
		}),
	);
	assert.ok(result.invitationId);
	return result.invitationId;
}
function accept(target: Actor, id: string) {
	return database.transaction((tx) =>
		acceptMembershipInvitation(tx, target.context, id, {
			operationId: randomUUID(),
			expectedRevision: 1,
			expectedMembershipVersion: 0,
			consent: true,
		}),
	);
}
async function revoke(person: Actor, entityId: string, grant: { id: string; revision: number }) {
	return database.transaction((tx) =>
		applyAccessRepresentationCommand(
			tx,
			{
				operation: "revoke",
				entityId,
				grantId: grant.id,
				expectedVersion: grant.revision,
				operationId: randomUUID(),
				operatorAuthUserId: person.account.id,
				authoritySubjectId: person.principalSubjectId,
			},
			sql<boolean>`true`,
		),
	);
}
async function recoveryGrant(person: Actor, validUntil: Date | null = null) {
	return database.transaction(async (tx) => {
		const scopeId = await allocateAccessScope(tx, { kind: "platform" }),
			roleId = randomUUID();
		const actor = {
			operatorAuthUserId: person.account.id,
			authoritySubjectId: person.principalSubjectId,
		};
		// SQL-admin setup qualifies consumption of the exact native permission, not grant-issuance policy.
		const role = await applyAccessRoleCommand(
			tx,
			{
				operation: "create",
				scopeId,
				roleId,
				expectedVersion: 0,
				operationId: randomUUID(),
				...actor,
				definition: {
					label: "Fixture Org recovery",
					description: null,
					permissions: [{ family: "management", key: "access.membership.recover" }],
				},
			},
			sql<boolean>`true`,
		);
		assert.ok(role.definitionRevision);
		await applyAccessRoleCommand(
			tx,
			{
				operation: "activate",
				scopeId,
				roleId,
				expectedVersion: role.version,
				definitionRevision: role.definitionRevision,
				operationId: randomUUID(),
				...actor,
			},
			sql<boolean>`true`,
		);
		return applyAccessRoleBindingCommand(
			tx,
			{
				operation: "create",
				targetScopeId: scopeId,
				bindingId: randomUUID(),
				roleId,
				expectedVersion: 0,
				operationId: randomUUID(),
				...actor,
				recipient: { kind: "subject", subjectId: person.principalSubjectId },
				terms: {
					targetPath: ["organization-recovery"],
					validFrom: new Date(Date.now() - 1000),
					validUntil,
					recipientEligibility: null,
					permissionPolicy: { mode: "local-role" },
				},
			},
			sql<boolean>`true`,
		);
	});
}
async function expiringControl(owner: Actor, org: Org, deadline: Date) {
	const receipt = await database.transaction(async (tx) => {
		const current = await readAccessRepresentationSnapshot(tx, {
			entityId: org.entityId,
			grantId: org.representation.id,
			revision: "current",
		});
		assert.ok(current?.targetScopeId);
		return applyAccessRepresentationCommand(
			tx,
			{
				operation: "narrow",
				entityId: org.entityId,
				grantId: current.id,
				expectedVersion: current.version,
				operationId: randomUUID(),
				operatorAuthUserId: owner.account.id,
				authoritySubjectId: owner.principalSubjectId,
				terms: {
					target: { kind: "scope", scopeId: current.targetScopeId, path: current.terms.targetPath },
					validFrom: current.terms.validFrom,
					validUntil: deadline,
					canRedelegate: current.terms.canRedelegate,
					requireFreshSession: current.terms.requireFreshSession,
					permissions: current.permissions,
					recipientEligibility: null,
				},
			},
			sql<boolean>`true`,
		);
	});
	org.representation = { id: receipt.grantId, revision: receipt.termsRevision };
	org.manager = represented(owner, org.entityId, org.representation);
}
async function waitPast(deadline: Date) {
	for (let i = 0; i < 500; i++) {
		if (
			(
				await database.execute<{ expired: boolean }>(
					sql`select clock_timestamp()>${deadline}::timestamptz+interval '25 milliseconds' as expired`,
				)
			).rows[0]?.expired
		)
			return;
		await setTimeout(10);
	}
	throw new Error("Database clock did not reach the native authority deadline");
}
async function invalidated(id: string) {
	await database
		.update(reviews)
		.set({ dueAt: new Date(0) })
		.where(eq(reviews.invitationId, id));
	await reconcileOrganizationEnrollmentBatch();
	const [row] = await database.select().from(invitations).where(eq(invitations.id, id));
	check(
		[row?.state, row?.authority],
		["invalidated", null],
		"due reconciliation records terminal invalidation and clears credential evidence",
	);
}
async function contact(person: Actor, org: Org) {
	return database.transaction((tx) =>
		createOrganizationEnrollmentContact(tx, person.direct, org.entityId),
	);
}
const recoveredSchema = z.strictObject({
	entityId: z.uuid(),
	revision: z.number().int().positive(),
	scopeId: z.uuid(),
	representation: z.strictObject({ id: z.uuid(), revision: z.number().int().positive() }),
});
const prefix = "/participation/membership/organizations";
async function request(person: Actor, path: string, body: unknown, status: number) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method: "POST",
			headers: {
				Cookie: person.cookie,
				"Content-Type": "application/json",
				"X-Rezics-Authority": JSON.stringify(person.direct.selection),
			},
			body: JSON.stringify(body),
		}),
	);
	const text = await response.text();
	check(response.status, status, `${path}: ${text.slice(0, 1200)}`);
	httpChecks++;
	return JSON.parse(text);
}
const pool = new Pool({
		connectionString: process.env.DATABASE_URL,
		max: 3,
		statement_timeout: 15000,
	}),
	raceDb = drizzle({ client: pool });
try {
	const owner = await actor("Original controller"),
		guest = await actor("Consent recipient"),
		operator = await actor("Recovery operator");
	const org = await organization(owner),
		pending = await invite(org, guest);
	await revoke(guest, guest.identity.entityId, guest.identity.representation);
	await assert.rejects(() => accept(guest, pending), ManagementAuthorityDenied);
	checks++;
	const replacement = await database.transaction((tx) =>
		applyAccessRepresentationCommand(
			tx,
			{
				operation: "create",
				entityId: guest.identity.entityId,
				grantId: randomUUID(),
				expectedVersion: 0,
				operationId: randomUUID(),
				operatorAuthUserId: guest.account.id,
				authoritySubjectId: guest.principalSubjectId,
				recipient: { kind: "subject", subjectId: guest.principalSubjectId },
				parent: null,
				terms: {
					target: { kind: "all-scopes" },
					validFrom: new Date(),
					validUntil: null,
					canRedelegate: true,
					requireFreshSession: false,
					permissions: [...AccessPermissionValues],
					recipientEligibility: null,
				},
			},
			sql<boolean>`true`,
		),
	);
	await assert.rejects(() => accept(guest, pending), ManagementAuthorityDenied);
	checks++;
	guest.context = represented(guest, guest.identity.entityId, {
		id: replacement.grantId,
		revision: replacement.termsRevision,
	});
	check(
		(await resolveMainIdentityPreference(guest.direct)).status,
		"selection-required",
		"new control does not silently repair an old private default selection",
	);
	const shared = await contact(owner, org);
	await request(
		operator,
		`${prefix}/${org.entityId}/recovery-recipient`,
		{ contact: shared.contact },
		403,
	);
	await recoveryGrant(operator);
	const selected = z
		.strictObject({ selector: z.string(), expiresAt: z.string() })
		.parse(
			await request(
				operator,
				`${prefix}/${org.entityId}/recovery-recipient`,
				{ contact: shared.contact },
				200,
			),
		);
	check(
		JSON.stringify(selected).includes(owner.account.id),
		false,
		"recovery selection discloses no stable private account ID",
	);
	const body = {
		operationId: randomUUID(),
		selector: selected.selector,
		expectedRevision: 1,
		evidence: "Fixture reviewed evidence",
	};
	await request(operator, `${prefix}/${org.entityId}/recover`, body, 403);
	await revoke(owner, org.entityId, org.representation);
	await assert.rejects(() => accept(guest, pending), ManagementAuthorityDenied);
	checks++;
	const recovered = recoveredSchema.parse(
		await request(operator, `${prefix}/${org.entityId}/recover`, body, 200),
	);
	check(recovered.revision, 2, "governed recovery advances the native Org control revision");
	check(
		await request(operator, `${prefix}/${org.entityId}/recover`, body, 200),
		recovered,
		"recovery operation retry preserves its original receipt",
	);
	await request(
		operator,
		`${prefix}/${org.entityId}/recover`,
		{ ...body, operationId: randomUUID() },
		409,
	);
	await assert.rejects(() => accept(guest, pending), AccessDenied);
	checks++;
	const old = (
		await database.transaction((tx) => listOwnMembershipInvitations(tx, guest.context, {}))
	).items.find((row) => row.id === pending);
	check(
		old?.availability,
		"deny",
		"new control cannot authorize the old invitation's captured generation",
	);
	await invalidated(pending);
	org.manager = represented(owner, org.entityId, recovered.representation);
	org.representation = recovered.representation;
	const fresh = await invite(org, guest);
	check(fresh === pending, false, "recovered control issues a new invitation identity");
	const accepted = await accept(guest, fresh);
	check(accepted.activeGeneration, 1, "current recipient control can accept fresh consent");
	assert.ok(accepted.membershipId);
	const controllerMembership = await database
		.select()
		.from(accessMembership)
		.where(
			and(
				eq(accessMembership.scopeId, org.scopeId),
				eq(accessMembership.subjectId, owner.principalSubjectId),
			),
		);
	check(controllerMembership.length, 0, "recovery gives control without private enrollment");
	await revoke(owner, org.entityId, org.representation);
	const secondBody = { ...body, operationId: randomUUID(), expectedRevision: 2 };
	const second = recoveredSchema.parse(
		await request(operator, `${prefix}/${org.entityId}/recover`, secondBody, 200),
	);
	check(
		(
			await database
				.select()
				.from(accessMembership)
				.where(eq(accessMembership.id, accepted.membershipId))
		)[0]?.activeGeneration,
		1,
		"accepted institutional membership survives another controller recovery",
	);
	check(second.revision, 3, "each successful recovery retains a separate control revision");

	// Replacing original inviter grant A with B does not revive a pending request, even at the same Org revision.
	const changed = await organization(owner),
		oldInvite = await invite(changed, guest);
	await revoke(owner, changed.entityId, changed.representation);
	const newControl = await database.transaction((tx) =>
		establishOrganizationEnrollmentControl(
			tx,
			{
				entityId: changed.entityId,
				recipientAuthUserId: owner.account.id,
				operatorAuthUserId: owner.account.id,
			},
			sql<boolean>`true`,
		),
	);
	assert.ok(newControl);
	await assert.rejects(() => accept(guest, oldInvite), ManagementAuthorityDenied);
	checks++;
	check(
		(
			await database.transaction((tx) => listOwnMembershipInvitations(tx, guest.context, {}))
		).items.find((row) => row.id === oldInvite)?.availability,
		"deny",
		"issuer replacement does not substitute an invitation's original grant",
	);
	await invalidated(oldInvite);
	changed.manager = represented(owner, changed.entityId, newControl.representation);
	check(
		(await accept(guest, await invite(changed, guest))).activeGeneration,
		1,
		"an explicitly selected replacement can issue a fresh invitation",
	);

	// Expiry is a current database-clock decision, including inside an open transaction.
	const expiring = await organization(owner),
		deadline = new Date(Date.now() + 2500);
	await expiringControl(owner, expiring, deadline);
	const expiringInvite = await invite(expiring, operator);
	const expiredContact = await contact(owner, expiring);
	const expirySelector = await selectOrganizationRecoveryRecipient(
		operator.direct,
		expiring.entityId,
		expiredContact.contact,
	);
	const expiryBody = {
		operationId: randomUUID(),
		selector: expirySelector.selector,
		expectedRevision: 1,
		evidence: "Expired original institutional control",
	};
	await assert.rejects(
		() => recoverNativeOrganization(operator.direct, expiring.entityId, expiryBody),
		AccessDenied,
	);
	checks++;
	await database.transaction(async (tx) =>
		withDatabaseTransactionContext(tx, async () => {
			await waitPast(deadline);
			const item = (await listOwnMembershipInvitations(tx, operator.context, {})).items.find(
				(row) => row.id === expiringInvite,
			);
			check(item?.availability, "deny", "issuer expiry applies inside the retained transaction");
			await assert.rejects(
				() =>
					tx.transaction((nested) =>
						acceptMembershipInvitation(nested, operator.context, expiringInvite, {
							operationId: randomUUID(),
							expectedRevision: 1,
							expectedMembershipVersion: 0,
							consent: true,
						}),
					),
				ManagementAuthorityDenied,
			);
			checks++;
			check(
				(await recoverNativeOrganization(operator.direct, expiring.entityId, expiryBody)).revision,
				2,
				"expired final control permits governed recovery in the same transaction",
			);
		}),
	);
	await invalidated(expiringInvite);

	const waitingOwner = await actor("Lock-wait controller"),
		waitingOperator = await actor("Expiring platform operator"),
		waitingOrg = await organization(waitingOwner);
	await revoke(waitingOwner, waitingOrg.entityId, waitingOrg.representation);
	const waitingContact = await contact(waitingOwner, waitingOrg),
		platformDeadline = new Date(Date.now() + 2500);
	await recoveryGrant(waitingOperator, platformDeadline);
	const waitingSelector = await selectOrganizationRecoveryRecipient(
		waitingOperator.direct,
		waitingOrg.entityId,
		waitingContact.contact,
	);
	const waitingBody = {
		operationId: randomUUID(),
		selector: waitingSelector.selector,
		expectedRevision: 1,
		evidence: "Recovery authority expires during the control lock wait",
	};
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const holding = raceDb.transaction(async (tx) => {
		await tx
			.select()
			.from(entityParticipation)
			.where(eq(entityParticipation.entityId, waitingOrg.entityId))
			.for("update");
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void holding.catch(held.reject);
	const blocker = await held.promise;
	const recovering = raceDb.transaction(async (tx) => {
		started.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return withDatabaseTransactionContext(tx, () =>
			recoverNativeOrganization(waitingOperator.direct, waitingOrg.entityId, waitingBody),
		);
	});
	void recovering.catch(started.reject);
	const denied = assert.rejects(recovering, AccessDenied);
	void denied.catch(() => {});
	try {
		const pid = await started.promise;
		let blocked = false,
			expired = false;
		for (let i = 0; i < 600; i++) {
			const result = (
				await pool.query<{ blocked: boolean; expired: boolean }>(
					"select $2::integer=any(pg_blocking_pids($1)) as blocked,clock_timestamp()>$3::timestamptz+interval '25 milliseconds' as expired",
					[pid, blocker, platformDeadline],
				)
			).rows[0];
			blocked ||= result?.blocked ?? false;
			expired = result?.expired ?? false;
			if (blocked && expired) break;
			await setTimeout(10);
		}
		check(
			blocked && expired,
			true,
			"recovery waits on the exact control fence beyond the native binding deadline",
		);
	} finally {
		release.resolve();
		await holding;
		await denied;
		checks++;
	}
	check(
		(
			await database
				.select()
				.from(entityParticipation)
				.where(eq(entityParticipation.entityId, waitingOrg.entityId))
		)[0]?.revision,
		1,
		"expired recovery appends no control generation",
	);
	check(
		(
			await database
				.select()
				.from(entityRecoveryEvent)
				.where(eq(entityRecoveryEvent.entityId, waitingOrg.entityId))
		).length,
		0,
		"expired recovery leaves no partial evidence receipt",
	);
	await assert.rejects(
		() => recoverNativeOrganization(waitingOperator.direct, waitingOrg.entityId, waitingBody),
		AccessDenied,
	);
	checks++;
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-membership-recovery.ts",
		"services/main/scripts/native-enrollment-fixture.ts",
		"services/main/src/services/participation/organization-recovery.ts",
		"services/main/src/services/participation/organization-control.ts",
		"services/main/src/services/participation/membership.ts",
		"services/main/src/services/participation/membership-worker.ts",
		"services/main/src/services/authorization/representations.ts",
		"services/main/src/services/authorization/management-authority.ts",
		"services/main/src/services/api/participation/membership.ts",
		"services/main/src/services/database/migrations/atlas.sum",
	])
		sourceDigests[path] = createHash("sha256")
			.update(await readFile(new URL(path, root)))
			.digest("hex");
	console.info(
		JSON.stringify({
			baseCommit: execFileSync("git", ["rev-parse", "HEAD"], {
				cwd: fileURLToPath(root),
				encoding: "utf8",
			}).trim(),
			sourceDigests,
			node: process.version,
			checks,
			httpChecks,
			scope:
				"Native control replacement and exact request/default non-revival, governed recovery/receipt HTTP, source expiry in a retained transaction, and recovery authority expiry across an observed control lock. Private session and native grant setup is fixture-only; dummy rows remain on the disposable target.",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
	await observability.shutdown();
}
