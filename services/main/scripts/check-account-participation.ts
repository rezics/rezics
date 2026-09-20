import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { OfficialRealmUnitIds } from "@rezics/slug";
import { and, desc, eq, sql } from "drizzle-orm";
import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import {
	database,
	withDatabaseTransactionDeadline,
	type DatabaseTransaction,
} from "../src/services/database";
import {
	users,
	post,
	accountFavorite,
	platformCapabilityGrant,
	realm,
	realmRule,
	realmRuleRevision,
	accountEnforcement,
	accountEnforcementAction,
} from "../src/services/database/schema";
import { accessMembership } from "@rezics/schema/postgres/access/access-membership";
import { organizationEnrollmentInvitation } from "@rezics/schema/postgres/access/organization-membership";
import { CredentialAuthorityDenied } from "../src/services/auth/credential-authority";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import { createFixtureSessionContext } from "./native-enrollment-fixture";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import { allocateReferenceValue } from "../src/services/units/reference-value";
import { applyAccessRepresentationCommand } from "../src/services/authorization/representations";
import { ManagementAuthorityDenied } from "../src/services/authorization/management-authority";
import type { RequestedAuthoritySelection } from "@rezics/access";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createGovernanceDecision } from "../src/services/governance/decision-service";
import { Authorization } from "../src/services/authorization";
import { AccountSuspended, AccountClosed } from "../src/services/auth/errors";
import { replacePlatformUserAccountState } from "../src/services/platform-users/service";
import {
	saveFavorite,
	deleteFavorite,
	readFavorite,
	listFavorites,
	listFavoriteHistory,
	readFavoriteRevision,
} from "../src/services/favorites/service";
import { AccountRestricted } from "../src/services/authorization/errors";
import { createManagedOrganization } from "../src/services/participation/organizations";
import {
	inviteOrganizationMember,
	acceptMembershipInvitation,
	declineMembershipInvitation,
	cancelMembershipInvitation,
	removeOrganizationMember,
	leaveOrganization,
	listOwnMembershipInvitations,
	listOrganizationMembers,
} from "../src/services/participation/membership";
import {
	runWithParticipationAuthority,
	type ParticipationAuthority,
} from "../src/services/participation/policy";
import { createCatalogIdentity } from "../src/services/catalog/storage";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Account participation qualification requires a disposable loopback target",
);
let checks = 0;
function check(actual: unknown, expected: unknown, message: string) {
	assert.deepEqual(actual, expected, message);
	checks++;
}
async function rejected(
	tx: DatabaseTransaction,
	work: (nested: DatabaseTransaction) => Promise<unknown>,
	expected: typeof AccountRestricted | typeof ManagementAuthorityDenied = AccountRestricted,
) {
	await assert.rejects(tx.transaction(work), expected);
	checks++;
}
async function favoriteTarget(tx: DatabaseTransaction) {
	const [target] = await tx
		.insert(post)
		.values({ visibility: "public", status: "published", publishedAt: new Date() })
		.returning({ id: post.id });
	assert.ok(target);
	return target.id;
}
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
	const direct = await createFixtureSessionContext(tx, account.id);
	const principalSubjectId = await allocateAccessSubject(tx, { kind: "principal", id: account.id });
	const subjectId = await allocateAccessSubject(tx, { kind: "entity", id: self.id });
	const scopeId = await allocateAccessScope(tx, {
		kind: "resource",
		referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: self.id }),
	});
	// Privileged fixture setup: native membership authority is explicit, never derived from the Self binding.
	const representation = await applyAccessRepresentationCommand(
		tx,
		{
			operation: "create",
			entityId: self.id,
			grantId: randomUUID(),
			expectedVersion: 0,
			operationId: randomUUID(),
			operatorAuthUserId: account.id,
			authoritySubjectId: principalSubjectId,
			recipient: { kind: "subject", subjectId: principalSubjectId },
			parent: null,
			terms: {
				target: { kind: "scope", scopeId, path: ["memberships"] },
				validFrom: new Date(),
				validUntil: null,
				canRedelegate: false,
				requireFreshSession: false,
				permissions: [{ family: "management", key: "access.membership.participate" }],
				recipientEligibility: null,
			},
		},
		sql<boolean>`true`,
	);
	const context = new PrincipalRequestContext(
		account.id,
		{
			mode: "represented",
			entityId: self.id,
			representations: [{ id: representation.grantId, revision: representation.termsRevision }],
		},
		direct.credentialProof(),
	);
	return { account, self, authority, context, subjectId };
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function organization(tx: DatabaseTransaction, owner: Actor) {
	const created = await runWithParticipationAuthority(owner.authority, () =>
		createManagedOrganization(tx, owner.authority, {
			name: "Account enforcement organization",
			language: "en",
		}),
	);
	assert.ok(created.native);
	const context = new PrincipalRequestContext(
		owner.account.id,
		{
			mode: "represented",
			entityId: created.entityId,
			representations: [created.native.representation],
		},
		owner.context.credentialProof(),
	);
	return { ...created, scopeId: created.native.scopeId, context };
}
const rule = await database.transaction(async (tx) => {
	const operator = await actor(tx, "Account fixture rule operator");
	await tx.insert(realm).values({ id: OfficialRealmUnitIds.rule }).onConflictDoNothing();
	let [revision] = await tx
		.select()
		.from(realmRuleRevision)
		.where(eq(realmRuleRevision.realmId, OfficialRealmUnitIds.rule))
		.orderBy(desc(realmRuleRevision.version))
		.limit(1);
	if (!revision)
		[revision] = await tx
			.insert(realmRuleRevision)
			.values({
				realmId: OfficialRealmUnitIds.rule,
				version: 1,
				createdByProfileId: operator.self.id,
				publishedAt: new Date(),
			})
			.returning();
	assert.ok(revision);
	let [selected] = await tx
		.select()
		.from(realmRule)
		.where(eq(realmRule.revisionId, revision.id))
		.limit(1);
	if (!selected)
		[selected] = await tx
			.insert(realmRule)
			.values({ revisionId: revision.id, position: 0 })
			.returning();
	assert.ok(selected);
	return { sourceRealmId: OfficialRealmUnitIds.rule, revisionId: revision.id, ruleId: selected.id };
});
async function enforce(
	tx: DatabaseTransaction,
	operator: Actor,
	subject: Actor,
	kind: "ban" | "suspension" | "silence",
	times: { expiresAt?: Date; startsAt?: Date } = {},
) {
	await tx
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, subject.account.id))
		.for("update");
	const decision = await createGovernanceDecision(tx, {
		action: "account.enforcement.create",
		actorProfileId: operator.self.id,
		authority: { kind: "platform" },
		targetUserId: subject.account.id,
		subject: { kind: "auth", id: subject.account.id },
		basis: { kind: "rules", rules: [rule!] },
	});
	const [action] = await tx
		.insert(accountEnforcementAction)
		.values({
			decisionId: decision.id,
			actorAuthUserId: operator.account.id,
			targetAuthUserId: subject.account.id,
			kind: "issue",
			enforcementKind: kind,
		})
		.returning();
	assert.ok(action);
	const [effect] = await tx
		.insert(accountEnforcement)
		.values({ authUserId: subject.account.id, kind, decisionActionId: action.id, ...times })
		.returning();
	assert.ok(effect);
	return { effect, action, decision };
}
async function revoke(
	tx: DatabaseTransaction,
	operator: Actor,
	record: Awaited<ReturnType<typeof enforce>>,
) {
	await tx
		.select({ id: users.id })
		.from(users)
		.where(eq(users.id, record.effect.authUserId))
		.for("update");
	const decision = await createGovernanceDecision(tx, {
		action: "account.enforcement.revoke",
		actorProfileId: operator.self.id,
		authority: { kind: "platform" },
		targetUserId: record.effect.authUserId,
		subject: { kind: "auth", id: record.effect.authUserId },
		basis: { kind: "reversal", reversesDecisionId: record.decision.id },
	});
	const [action] = await tx
		.insert(accountEnforcementAction)
		.values({
			decisionId: decision.id,
			actorAuthUserId: operator.account.id,
			targetAuthUserId: record.effect.authUserId,
			kind: "revoke",
			enforcementKind: record.effect.kind,
			reversesActionId: record.action.id,
		})
		.returning();
	assert.ok(action);
	await tx
		.update(accountEnforcement)
		.set({ revocationActionId: action.id })
		.where(eq(accountEnforcement.id, record.effect.id));
}
async function contribute(tx: DatabaseTransaction, person: Actor) {
	return runWithParticipationAuthority(person.authority, () =>
		createCatalogIdentity(
			tx,
			{
				owner: "entity",
				shape: "person",
				visibility: "public",
			},
			person.account.id,
		),
	);
}
const rollback = new Error("rollback account participation fixture");
try {
	await withDatabaseTransactionDeadline(45000, () =>
		database.transaction(async (tx) => {
			const operator = await actor(tx, "Enforcement operator"),
				owner = await actor(tx, "Enforcement inviter"),
				guest = await actor(tx, "Enforcement recipient");
			const org = await organization(tx, owner);
			const pending = await inviteOrganizationMember(tx, org.context, org.entityId, {
				operationId: randomUUID(),
				recipient: { kind: "entity", entityId: guest.self.id },
			});
			assert.ok(pending.invitationId);
			const ban = await enforce(tx, operator, guest, "ban");
			await rejected(
				tx,
				(nested) =>
					acceptMembershipInvitation(nested, guest.context, pending.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					}),
				ManagementAuthorityDenied,
			);
			await rejected(
				tx,
				(nested) =>
					declineMembershipInvitation(nested, guest.context, pending.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
					}),
				ManagementAuthorityDenied,
			);
			await rejected(tx, (nested) => contribute(nested, guest));
			check(
				(await listOwnMembershipInvitations(tx, guest.context, {})).items.some(
					(i) => i.id === pending.invitationId!,
				),
				true,
				"an enforced account can still read its private inbox",
			);
			await revoke(tx, operator, ban);
			check(
				(
					await acceptMembershipInvitation(tx, guest.context, pending.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					})
				).state,
				"accepted",
				"revocation restores membership admission",
			);
			const suspension = await enforce(tx, operator, owner, "suspension");
			const other = await actor(tx, "Other enforcement recipient");
			await rejected(
				tx,
				(nested) =>
					inviteOrganizationMember(nested, org.context, org.entityId, {
						operationId: randomUUID(),
						recipient: { kind: "entity", entityId: other.self.id },
					}),
				ManagementAuthorityDenied,
			);
			await rejected(
				tx,
				(nested) =>
					removeOrganizationMember(nested, org.context, org.entityId, {
						operationId: randomUUID(),
						expectedMembershipVersion: 1,
						recipient: { kind: "entity", entityId: guest.self.id },
					}),
				ManagementAuthorityDenied,
			);
			check(
				(await listOrganizationMembers(tx, org.context, org.entityId, {})).items.length,
				1,
				"enforcement does not turn roster read authority into a write grant",
			);
			await revoke(tx, operator, suspension);
			const otherPending = await inviteOrganizationMember(tx, org.context, org.entityId, {
				operationId: randomUUID(),
				recipient: { kind: "entity", entityId: other.self.id },
			});
			assert.ok(otherPending.invitationId);
			const bannedManager = await enforce(tx, operator, owner, "ban");
			await rejected(
				tx,
				(nested) =>
					cancelMembershipInvitation(
						nested,
						org.context,
						org.entityId,
						otherPending.invitationId!,
						{ operationId: randomUUID(), expectedRevision: 1 },
					),
				ManagementAuthorityDenied,
			);
			await rejected(
				tx,
				(nested) =>
					acceptMembershipInvitation(nested, other.context, otherPending.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					}),
				ManagementAuthorityDenied,
			);
			await revoke(tx, operator, bannedManager);
			const guestBan = await enforce(tx, operator, guest, "ban");
			await rejected(
				tx,
				(nested) =>
					leaveOrganization(nested, guest.context, org.entityId, {
						operationId: randomUUID(),
						expectedMembershipVersion: 1,
					}),
				ManagementAuthorityDenied,
			);
			await revoke(tx, operator, guestBan);
			const silence = await enforce(tx, operator, other, "silence");
			check(
				(
					await acceptMembershipInvitation(tx, other.context, otherPending.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					})
				).state,
				"accepted",
				"silence permits membership writes",
			);
			await rejected(tx, (nested) => contribute(nested, other));
			await revoke(tx, operator, silence);
			assert.ok(await contribute(tx, other));
			checks++;
			const now = Date.now();
			await enforce(tx, operator, other, "ban", {
				startsAt: new Date(now - 2000),
				expiresAt: new Date(now - 1000),
			});
			assert.ok(await contribute(tx, other));
			checks++;
			await enforce(tx, operator, other, "ban", { startsAt: new Date(now + 60000) });
			assert.ok(await contribute(tx, other));
			checks++;
			const favoriteOwner = await actor(tx, "Favorite enforced owner"),
				favoriteId = await favoriteTarget(tx);
			await saveFavorite(tx, favoriteOwner.authority, favoriteId, {
				expectedRevision: 0,
				note: "Retained private note",
			});
			const favoriteBan = await enforce(tx, operator, favoriteOwner, "ban");
			await rejected(tx, (nested) =>
				saveFavorite(nested, favoriteOwner.authority, favoriteId, {
					expectedRevision: 1,
					note: "Denied edit",
				}),
			);
			await rejected(tx, (nested) =>
				deleteFavorite(nested, favoriteOwner.authority, favoriteId, 1),
			);
			await rejected(tx, (nested) =>
				saveFavorite(nested, favoriteOwner.authority, favoriteId, { expectedRevision: 1 }, 1),
			);
			check(
				(await readFavorite(tx, favoriteOwner.authority, favoriteId)).entry?.note,
				"Retained private note",
				"ban preserves private saved content and read access",
			);
			check(
				(await listFavoriteHistory(tx, favoriteOwner.authority, favoriteId)).items.length,
				1,
				"denied favorite mutations append no history",
			);
			await revoke(tx, operator, favoriteBan);
			await enforce(tx, operator, favoriteOwner, "silence");
			check(
				(await saveFavorite(tx, favoriteOwner.authority, favoriteId, { expectedRevision: 1 }))
					.revision,
				2,
				"silence permits private Favorite writes",
			);
			await tx.insert(platformCapabilityGrant).values({
				authUserId: operator.account.id,
				capability: "platform.user.status.update",
				grantedByAuthUserId: operator.account.id,
			});
			const authorization = new Authorization(
				operator.self.id,
				operator.account.id,
				operator.authority,
			);
			const invitation = await inviteOrganizationMember(tx, org.context, org.entityId, {
				operationId: randomUUID(),
				recipient: { kind: "entity", entityId: favoriteOwner.self.id },
			});
			assert.ok(invitation.invitationId);
			await replacePlatformUserAccountState({
				authorization,
				targetUserId: favoriteOwner.account.id,
				command: { state: "suspended", expectedRevision: 0, rules: [rule] },
			});
			const favoriteReads = [
				(nested: DatabaseTransaction) => listFavorites(nested, favoriteOwner.authority, {}),
				(nested: DatabaseTransaction) => readFavorite(nested, favoriteOwner.authority, favoriteId),
				(nested: DatabaseTransaction) =>
					listFavoriteHistory(nested, favoriteOwner.authority, favoriteId),
				(nested: DatabaseTransaction) =>
					readFavoriteRevision(nested, favoriteOwner.authority, favoriteId, 1),
			];
			for (const work of [
				...favoriteReads,
				(nested: DatabaseTransaction) =>
					saveFavorite(nested, favoriteOwner.authority, favoriteId, { expectedRevision: 2 }),
			]) {
				await assert.rejects(tx.transaction<unknown>(work), AccountSuspended);
				checks++;
			}
			await assert.rejects(
				tx.transaction((nested) =>
					acceptMembershipInvitation(nested, favoriteOwner.context, invitation.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					}),
				),
				CredentialAuthorityDenied,
			);
			checks++;
			await replacePlatformUserAccountState({
				authorization,
				targetUserId: favoriteOwner.account.id,
				command: { state: "active", expectedRevision: 1, rules: [rule] },
			});
			await assert.rejects(
				tx.transaction((nested) =>
					acceptMembershipInvitation(nested, favoriteOwner.context, invitation.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					}),
				),
				CredentialAuthorityDenied,
			);
			checks++;
			const renewed = await createFixtureSessionContext(tx, favoriteOwner.account.id);
			const restoredContext = new PrincipalRequestContext(
				favoriteOwner.account.id,
				favoriteOwner.context.selection,
				renewed.credentialProof(),
			);
			check(
				(await saveFavorite(tx, favoriteOwner.authority, favoriteId, { expectedRevision: 2 }, 1))
					.revision,
				3,
				"account restoration re-enables a permitted Favorite restore",
			);
			check(
				(
					await acceptMembershipInvitation(tx, restoredContext, invitation.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					})
				).state,
				"accepted",
				"restored sign-in status and a new session re-enable membership consent",
			);
			await replacePlatformUserAccountState({
				authorization,
				targetUserId: favoriteOwner.account.id,
				command: { state: "closed", expectedRevision: 2, rules: [rule] },
			});
			for (const work of [
				...favoriteReads,
				(nested: DatabaseTransaction) =>
					deleteFavorite(nested, favoriteOwner.authority, favoriteId, 3),
			]) {
				await assert.rejects(tx.transaction<unknown>(work), AccountClosed);
				checks++;
			}

			throw rollback;
		}),
	);
} catch (error) {
	if (error !== rollback) throw error;
}

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
	throw new Error("Expected the exact account-fence blocker");
}
try {
	for (const operation of ["membership", "contribution", "favorite"] as const) {
		const setup = await raceDb.transaction(async (tx) => {
			const operator = await actor(tx, "Concurrent enforcement operator"),
				owner = await actor(tx, "Concurrent inviter"),
				guest = await actor(tx, "Concurrent recipient");
			const org = await organization(tx, owner);
			const invitation = await inviteOrganizationMember(tx, org.context, org.entityId, {
				operationId: randomUUID(),
				recipient: { kind: "entity", entityId: guest.self.id },
			});
			assert.ok(invitation.invitationId);
			return { operator, guest, org, invitation, favoriteId: await favoriteTarget(tx) };
		});
		const held = Promise.withResolvers<number>(),
			release = Promise.withResolvers<void>(),
			waiting = Promise.withResolvers<number>();
		const enforcement = raceDb.transaction(async (tx) => {
			await enforce(tx, setup.operator, setup.guest, "suspension");
			held.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await release.promise;
		});
		void enforcement.catch(held.reject);
		const holder = await held.promise;
		const mutation = raceDb.transaction(async (tx) => {
			waiting.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			return operation === "membership"
				? acceptMembershipInvitation(tx, setup.guest.context, setup.invitation.invitationId!, {
						operationId: randomUUID(),
						expectedRevision: 1,
						expectedMembershipVersion: 0,
						consent: true,
					})
				: operation === "favorite"
					? saveFavorite(tx, setup.guest.authority, setup.favoriteId, { expectedRevision: 0 })
					: contribute(tx, setup.guest);
		});
		void mutation.catch(waiting.reject);
		const denied = assert.rejects(
			mutation,
			operation === "membership" ? ManagementAuthorityDenied : AccountRestricted,
		);
		void denied.catch(() => {});
		try {
			await blocked(await waiting.promise, holder);
			checks++;
		} finally {
			release.resolve();
			await enforcement;
			await denied;
			checks++;
		}
		check(
			(
				await raceDb
					.select()
					.from(accessMembership)
					.where(
						and(
							eq(accessMembership.scopeId, setup.org.scopeId),
							eq(accessMembership.subjectId, setup.guest.subjectId),
						),
					)
			).length,
			0,
			"enforcement-first admission creates no membership",
		);
		check(
			(
				await raceDb
					.select()
					.from(organizationEnrollmentInvitation)
					.where(eq(organizationEnrollmentInvitation.id, setup.invitation.invitationId!))
			)[0]?.state,
			"pending",
			"denied admission does not consume the invitation",
		);
		if (operation === "favorite")
			check(
				(
					await raceDb
						.select()
						.from(accountFavorite)
						.where(eq(accountFavorite.authUserId, setup.guest.account.id))
				).length,
				0,
				"enforcement-first favorite writes no saved entry",
			);
	}

	for (const operation of ["membership", "contribution", "favorite"] as const) {
		const setup = await raceDb.transaction(async (tx) => {
			const operator = await actor(tx, "Admission-first enforcer"),
				owner = await actor(tx, "Admission-first inviter"),
				guest = await actor(tx, "Admission-first recipient");
			const org = await organization(tx, owner);
			const invitation = await inviteOrganizationMember(tx, org.context, org.entityId, {
				operationId: randomUUID(),
				recipient: { kind: "entity", entityId: guest.self.id },
			});
			assert.ok(invitation.invitationId);
			return { operator, guest, org, invitation, favoriteId: await favoriteTarget(tx) };
		});
		const held = Promise.withResolvers<number>(),
			release = Promise.withResolvers<void>(),
			waiting = Promise.withResolvers<number>();
		const admitted = raceDb.transaction(async (tx) => {
			const result =
				operation === "membership"
					? await acceptMembershipInvitation(
							tx,
							setup.guest.context,
							setup.invitation.invitationId!,
							{
								operationId: randomUUID(),
								expectedRevision: 1,
								expectedMembershipVersion: 0,
								consent: true,
							},
						)
					: operation === "favorite"
						? await saveFavorite(tx, setup.guest.authority, setup.favoriteId, {
								expectedRevision: 0,
							})
						: await contribute(tx, setup.guest);
			assert.ok(result);
			checks++;
			held.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await release.promise;
		});
		void admitted.catch(held.reject);
		const holder = await held.promise;
		const enforcement = raceDb.transaction(async (tx) => {
			waiting.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			return enforce(tx, setup.operator, setup.guest, "ban");
		});
		void enforcement.catch(waiting.reject);
		try {
			await blocked(await waiting.promise, holder);
			checks++;
		} finally {
			release.resolve();
			await admitted;
			await enforcement;
		}
		check(
			(
				await raceDb
					.select()
					.from(organizationEnrollmentInvitation)
					.where(eq(organizationEnrollmentInvitation.id, setup.invitation.invitationId!))
			)[0]?.state,
			operation === "membership" ? "accepted" : "pending",
			"later enforcement preserves the committed admission outcome",
		);
		await assert.rejects(
			raceDb.transaction((tx) => contribute(tx, setup.guest)),
			AccountRestricted,
		);
		checks++;
		if (operation === "favorite")
			check(
				(
					await raceDb
						.select()
						.from(accountFavorite)
						.where(eq(accountFavorite.authUserId, setup.guest.account.id))
				).length,
				1,
				"later enforcement retains the committed favorite",
			);
	}
} finally {
	await pool.end();
}
const { initializeObservability } = await import("@rezics/observability");
const observability = initializeObservability({
	service: {
		name: "rezics-account-participation-qualification",
		version: "1.0.0",
		environment: "tooling",
	},
});
const { serializeSignedCookie } = await import("better-call");
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
api.compile();
const context = await auth.$context;
async function cookie(person: Actor) {
	const record = await context.internalAdapter.createSession(person.account.id);
	const [value] = (
		await serializeSignedCookie(
			context.authCookies.sessionToken.name,
			record.token,
			context.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(value);
	return value;
}
const http = await database.transaction(async (tx) => {
	const operator = await actor(tx, "HTTP enforcer"),
		owner = await actor(tx, "HTTP inviter"),
		guest = await actor(tx, "HTTP member");
	await tx.insert(platformCapabilityGrant).values({
		authUserId: operator.account.id,
		capability: "platform.moderate",
		grantedByAuthUserId: operator.account.id,
	});
	const org = await organization(tx, owner);
	const invitation = await inviteOrganizationMember(tx, org.context, org.entityId, {
		operationId: randomUUID(),
		recipient: { kind: "entity", entityId: guest.self.id },
	});
	assert.ok(invitation.invitationId);
	return { operator, guest, invitation };
});
const operatorCookie = await cookie(http.operator),
	guestCookie = await cookie(http.guest);
let httpChecks = 0;
async function request(
	method: string,
	path: string,
	body: unknown,
	expectedStatus: number,
	token: string,
	selection?: RequestedAuthoritySelection,
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method,
			headers: {
				Cookie: token,
				...(selection ? { "X-Rezics-Authority": JSON.stringify(selection) } : {}),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `${method} ${path}: ${text.slice(0, 1000)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
try {
	const effect = await request(
		"POST",
		"/governance/account-enforcements",
		{ authUserId: http.guest.account.id, kind: "ban", rules: [rule] },
		200,
		operatorCookie,
	);
	const denied = await request(
		"POST",
		`/participation/membership/invitations/${http.invitation.invitationId!}/accept`,
		{ operationId: randomUUID(), expectedRevision: 1, expectedMembershipVersion: 0, consent: true },
		403,
		guestCookie,
		http.guest.context.selection,
	);
	check(
		denied.error.code,
		"AccessDenied",
		"HTTP membership returns the declared enforcement error",
	);
	await request(
		"GET",
		"/participation/membership/me/invitations",
		undefined,
		200,
		guestCookie,
		http.guest.context.selection,
	);
	await request(
		"POST",
		`/governance/account-enforcements/${effect.id}/revoke`,
		{},
		200,
		operatorCookie,
	);
	const accepted = await request(
		"POST",
		`/participation/membership/invitations/${http.invitation.invitationId!}/accept`,
		{ operationId: randomUUID(), expectedRevision: 1, expectedMembershipVersion: 0, consent: true },
		200,
		guestCookie,
		http.guest.context.selection,
	);
	check(accepted.state, "accepted", "HTTP revocation restores the pending invitation's admission");
} finally {
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-account-participation.ts",
	"services/main/src/services/favorites/service.ts",
	"services/main/src/services/platform-users/service.ts",
	"services/main/src/services/participation/membership.ts",
	"services/main/src/services/api/participation/membership.ts",
	"services/main/src/services/participation/policy.ts",
	"services/main/src/services/authorization/account/authorization.ts",
	"services/main/src/services/authorization/account/policy.ts",
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
		favoritesAccountAdmissionQualified: true,
		membershipEnforcementQualified: true,
		contributionEnforcementQualified: true,
	}),
);
console.info(
	`Verified ${checks} account enforcement/participation assertions; transaction cases rolled back and race actors retained only on the disposable target.`,
);
process.exit(0);
