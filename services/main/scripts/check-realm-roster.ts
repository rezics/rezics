import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serializeSignedCookie } from "better-call";
import { z } from "zod";
import { initializeObservability } from "@rezics/observability";
import { database } from "../src/services/database";
import { users, realm, unitOwnership, entityIdentity } from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { updateEntityPresentation } from "../src/services/participation/presentation";
import type { ParticipationAuthority } from "../src/services/participation/policy";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import {
	allocateAccessScope,
	allocateAccessSubject,
} from "../src/services/authorization/identities";
import { allocateReferenceValue } from "../src/services/units/reference-value";
import { applyAccessRepresentationCommand } from "../src/services/authorization/representations";
import { applyAccessRoleBindingCommand } from "../src/services/authorization/role-bindings";
import { ManagementAuthorityDenied } from "../src/services/authorization/management-authority";
import { AccessInputInvalid } from "../src/services/authorization/http-errors";
import {
	membershipRecipients,
	membershipRecipientContext,
} from "../src/services/realms/membership-policy";
import { joinRealm } from "../src/services/realms/membership";
import { listRealmMembers, listPublicRealmMembers } from "../src/services/realms/roster";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
	fixtureMembershipManager,
} from "./native-enrollment-fixture";

assertNativeEnrollmentFixture();
const observability = initializeObservability({
	service: { name: "rezics-native-realm-roster", version: "1.0.0", environment: "tooling" },
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
	const person = await database.transaction(async (tx) => {
		const [account] = await tx
			.insert(users)
			.values({
				name: "Private sign-in label",
				email: `${randomUUID()}@roster.invalid`,
				emailVerified: true,
			})
			.returning();
		assert.ok(account);
		// Retained presentation setup is independent from the native grant used below.
		const self = await ensureSelfEntityInTransaction(tx, account);
		const participation: ParticipationAuthority = {
			principal: { kind: "auth", authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		};
		if (name)
			await updateEntityPresentation(tx, participation, {
				language: "en",
				name,
				expectedRevision: 0,
			});
		return { account, self, participation };
	});
	const session = await authContext.internalAdapter.createSession(person.account.id),
		direct = fixturePrincipalContext(session);
	const context = await database.transaction(async (tx) => {
		const subjectId = await allocateAccessSubject(tx, { kind: "principal", id: person.account.id });
		const scopeId = await allocateAccessScope(tx, {
			kind: "resource",
			referenceValueId: await allocateReferenceValue(tx, { owner: "entity", id: person.self.id }),
		});
		const grant = await applyAccessRepresentationCommand(
			tx,
			{
				operation: "create",
				entityId: person.self.id,
				grantId: randomUUID(),
				expectedVersion: 0,
				operationId: randomUUID(),
				operatorAuthUserId: person.account.id,
				authoritySubjectId: subjectId,
				recipient: { kind: "subject", subjectId },
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
		return new PrincipalRequestContext(
			person.account.id,
			{
				mode: "represented",
				entityId: person.self.id,
				representations: [{ id: grant.grantId, revision: grant.termsRevision }],
			},
			direct.credentialProof(),
		);
	});
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { ...person, session, cookie, direct, context };
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function ownedRealm(owner: Actor, approval = false) {
	return database.transaction(async (tx) => {
		const [record] = await tx
			.insert(realm)
			.values({
				status: "published",
				publishedAt: new Date(),
				visibility: "public",
				joinPolicy: approval ? "approval" : "open",
			})
			.returning();
		assert.ok(record);
		await tx
			.insert(unitOwnership)
			.values({ unitId: record.id, profileId: owner.self.id, assignedByProfileId: owner.self.id });
		const manager = await fixtureMembershipManager(tx, owner.session, {
			owner: "realm",
			id: record.id,
		});
		return { record, manager };
	});
}
type Realm = Awaited<ReturnType<typeof ownedRealm>>;
async function join(person: Actor, target: Realm) {
	return database.transaction((tx) =>
		joinRealm(tx, person.context, target.record.id, {
			operationId: randomUUID(),
			expectedControlRevision: target.record.membershipControlRevision,
			expectedRevision: 0,
			expectedMembershipVersion: 0,
			expectedEnforcementRevision: 0,
			consent: true,
			ruleRevisionId: null,
		}),
	);
}
const pageSchema = z.strictObject({
	items: z.array(
		z.strictObject({
			profileId: z.uuid(),
			name: z.string().nullable(),
			language: z.string().nullable(),
			avatar: z.unknown(),
			slugAddress: z.unknown(),
			isOwner: z.boolean(),
			state: z.string(),
			joinedAt: z.string(),
		}),
	),
	nextCursor: z.string().nullable(),
});
async function request(
	target: Realm,
	person: Actor,
	status = 200,
	query: Record<string, string> = {},
	selected = person.direct,
) {
	const response = await api.fetch(
		new Request(
			`http://localhost:3001/api/v1/realms/${target.record.id}/members?${new URLSearchParams(query)}`,
			{
				headers: {
					Cookie: person.cookie,
					"X-Rezics-Authority": JSON.stringify(selected.selection),
				},
			},
		),
	);
	const body = await response.text();
	check(response.status, status, `Realm roster: ${body.slice(0, 1000)}`);
	httpChecks++;
	return status === 200 ? pageSchema.parse(JSON.parse(body)) : null;
}
const owner = await actor("Roster owner"),
	guest = await actor("Public roster member"),
	outsider = await actor("Roster outsider");
const subject = await ownedRealm(owner);
await join(owner, subject);
await join(guest, subject);
let queryPlan: unknown;
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 3,
	statement_timeout: 15000,
});
const queries: Array<{ query: string; params: unknown[] }> = [];
const raceDb = drizzle({
	client: pool,
	logger: {
		logQuery(query, params) {
			if (
				query.includes('from "realm_enrollment"') &&
				query.includes('order by "realm_enrollment"."subject_id"')
			)
				queries.push({ query, params });
		},
	},
});
try {
	const first = await request(subject, owner);
	assert.ok(first);
	check(
		first.items.find((item) => item.profileId === guest.self.id)?.name,
		"Public roster member",
		"roster uses explicit public presentation",
	);
	check(
		JSON.stringify(first).includes("Private sign-in label"),
		false,
		"private account names are absent",
	);
	check(
		JSON.stringify(first).includes(guest.account.id),
		false,
		"public roster omits private account IDs",
	);
	check(first.nextCursor, null, "complete roster has no continuation");
	check(
		first.items.find((item) => item.profileId === owner.self.id)?.isOwner,
		true,
		"concrete ownership is preserved",
	);
	await request(subject, outsider, 403);
	await request(subject, owner, 403, {}, owner.context);
	await request(subject, owner, 422, { afterProfileId: guest.self.id });
	const unnamed = await actor("");
	const pendingRealm = await ownedRealm(owner, true);
	const pending = await join(unnamed, pendingRealm);
	check(pending.state, "pending", "approval Realm keeps the explicit request pending");
	const unnamedPage = await request(pendingRealm, owner);
	assert.ok(unnamedPage);
	check(
		unnamedPage.items.map((item) => [item.name, item.language, item.state]),
		[[null, null, "pending"]],
		"absent presentation stays absent for pending enrollment",
	);
	const localized = await actor("");
	await database.transaction((tx) =>
		updateEntityPresentation(tx, localized.participation, {
			language: "sr-Latn-RS",
			name: "Član",
			expectedRevision: 0,
			avatar: { type: "emoji", emoji: "🦉" },
		}),
	);
	await join(localized, subject);
	const localPage = await request(subject, owner);
	assert.ok(localPage);
	const local = localPage.items.find((item) => item.profileId === localized.self.id);
	check(
		[local?.language, local?.name, local?.avatar],
		["sr-Latn-RS", "Član", { type: "emoji", emoji: "🦉" }],
		"regional language and native avatar survive hydration",
	);
	await database
		.update(entityIdentity)
		.set({ visibility: "private" })
		.where(eq(entityIdentity.id, guest.self.id));
	const hidden = await request(subject, owner);
	assert.ok(hidden);
	const hiddenMember = hidden.items.find((item) => item.profileId === guest.self.id);
	check(
		[hiddenMember?.name, hiddenMember?.avatar, hiddenMember?.language, hiddenMember?.slugAddress],
		[null, null, null, null],
		"roster permission does not disclose private Entity presentation",
	);

	// Native inactive heads model physical candidates, not fabricated admission or consent.
	// The low subject IDs place 10,000 private candidates before the public tail.
	const large = await ownedRealm(owner);
	const suffix = `${randomUUID().replaceAll("-", "").slice(0, 6)}-${randomUUID().slice(0, 4)}`;
	const subjectPrefix = `00${suffix}`,
		accountPrefix = `10${suffix}`;
	for (let start = 1; start <= 10000; start += 500)
		await database.transaction(async (tx) => {
			await tx.execute(sql`insert into public.users(id,name,email,email_verified)
   select (${accountPrefix}||'-8000-8000-'||lpad(to_hex(i),12,'0'))::uuid,'Private candidate',${suffix}||'-'||i||'@roster.invalid',true from generate_series(${start}::integer,${start + 499}::integer) i`);
			await tx.execute(sql`insert into public.access_subject(id,auth_user_id)
   select (${subjectPrefix}||'-8000-8000-'||lpad(to_hex(i),12,'0'))::uuid,(${accountPrefix}||'-8000-8000-'||lpad(to_hex(i),12,'0'))::uuid from generate_series(${start}::integer,${start + 499}::integer) i`);
		});
	async function candidates(target: Realm) {
		for (let start = 1; start <= 10000; start += 500)
			await database.transaction(async (tx) => {
				await tx.execute(sql`insert into public.access_membership(scope_id,subject_id)
    select ${target.manager.scopeId}::uuid,(${subjectPrefix}||'-8000-8000-'||lpad(to_hex(i),12,'0'))::uuid from generate_series(${start}::integer,${start + 499}::integer) i`);
				await tx.execute(sql`insert into public.realm_enrollment(scope_id,subject_id,realm_id,membership_id)
    select m.scope_id,m.subject_id,${target.record.id}::uuid,m.id from public.access_membership m
    where m.scope_id=${target.manager.scopeId}::uuid and m.subject_id>=(${subjectPrefix}||'-8000-8000-'||lpad(to_hex(${start}::integer),12,'0'))::uuid
     and m.subject_id<=(${subjectPrefix}||'-8000-8000-'||lpad(to_hex(${start + 499}::integer),12,'0'))::uuid`);
			});
	}
	await candidates(large);
	await join(localized, large);
	const seen = new Set<string>();
	let cursor: string | null = null,
		pages = 0,
		emptyContinuations = 0,
		firstCursor: string | undefined;
	const cursorValues = new Set<string>();
	do {
		const page = await request(large, owner, 200, cursor ? { afterId: cursor } : {});
		assert.ok(page);
		check(page.items.length <= 50, true, "public page never exceeds its candidate bound");
		if (!page.items.length && page.nextCursor) emptyContinuations++;
		for (const item of page.items) {
			assert.ok(!seen.has(item.profileId));
			seen.add(item.profileId);
		}
		if (page.nextCursor) {
			assert.ok(!cursorValues.has(page.nextCursor));
			cursorValues.add(page.nextCursor);
			firstCursor ??= page.nextCursor;
		}
		cursor = page.nextCursor;
		assert.ok(++pages <= 201, "every encrypted cursor advances the physical candidate seek");
	} while (cursor);
	check([...seen], [localized.self.id], "filtered paging reaches the public tail exactly once");
	check(
		[pages, emptyContinuations],
		[201, 200],
		"50-candidate pages preserve filtered empty continuations",
	);
	assert.ok(firstCursor);
	await request(large, owner, 400, {
		afterId:
			firstCursor.slice(0, 12) + (firstCursor[12] === "a" ? "b" : "a") + firstCursor.slice(13),
	});
	await request(subject, owner, 400, { afterId: firstCursor });
	await assert.rejects(
		database.transaction((tx) =>
			listRealmMembers(tx, owner.direct, large.record.id, {
				view: "operational",
				afterId: firstCursor,
			}),
		),
		AccessInputInvalid,
	);
	checks++;
	const renewed = fixturePrincipalContext(
		await authContext.internalAdapter.createSession(owner.account.id),
	);
	await assert.rejects(
		database.transaction((tx) =>
			listRealmMembers(tx, renewed, large.record.id, { view: "public", afterId: firstCursor }),
		),
		AccessInputInvalid,
	);
	checks++;
	const dense = await database.transaction((tx) =>
		listRealmMembers(tx, owner.direct, large.record.id, { view: "operational" }),
	);
	assert.ok(dense.nextCursor);
	const next = await database.transaction((tx) =>
		listRealmMembers(tx, owner.direct, large.record.id, {
			view: "operational",
			afterId: dense.nextCursor!,
		}),
	);
	check(
		[dense.items.length, next.items.length],
		[50, 50],
		"operational pages keep their fixed bound",
	);
	const keys = [...dense.items, ...next.items].map((item) => {
		assert.equal(item.recipient.kind, "principal");
		if (item.recipient.kind !== "principal") throw new Error("Expected private recipient");
		return membershipRecipients.resolve(
			item.recipient.selector,
			membershipRecipientContext(owner.direct, large.manager.scopeId),
			Date.now(),
		);
	});
	check(
		keys,
		Array.from(
			{ length: 100 },
			(_, index) => `${subjectPrefix}-8000-8000-${(index + 1).toString(16).padStart(12, "0")}`,
		),
		"private dense pages return the exact first 100 subjects in order",
	);
	check(
		JSON.stringify(dense).includes(accountPrefix),
		false,
		"opaque private selectors do not expose account IDs",
	);
	await pool.query("analyze realm_enrollment");
	await raceDb.transaction((tx) =>
		listRealmMembers(tx, owner.direct, large.record.id, { view: "public" }),
	);
	const candidate = queries.at(-1);
	assert.ok(candidate);
	const concentrated = (
		await pool.query(`explain (analyze,buffers,format json) ${candidate.query}`, candidate.params)
	).rows[0];
	check(
		JSON.stringify(concentrated).includes('"Node Type":"Sort"'),
		false,
		"concentrated candidate lookup retains index order",
	);
	for (let i = 0; i < 10; i++) await candidates(await ownedRealm(owner));
	await pool.query("analyze realm_enrollment");
	const selective = (
		await pool.query(`explain (analyze,buffers,format json) ${candidate.query}`, candidate.params)
	).rows[0];
	queryPlan = { concentrated, selective };
	check(
		JSON.stringify(selective).includes("realm_enrollment_pkey"),
		true,
		"actual scope/subject candidate query uses its native key",
	);
	check(
		JSON.stringify(selective).includes('"Node Type":"Sort"'),
		false,
		"background roster lookup avoids a sort",
	);
	const grant = await database.transaction((tx) =>
		fixtureMembershipManager(tx, outsider.session, { owner: "realm", id: subject.record.id }),
	);
	await request(subject, outsider);
	const held = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		waiting = Promise.withResolvers<number>();
	const revoking = raceDb.transaction(async (tx) => {
		await applyAccessRoleBindingCommand(
			tx,
			{
				operation: "revoke",
				targetScopeId: grant.scopeId,
				bindingId: grant.binding.bindingId,
				expectedVersion: grant.binding.version,
				operationId: randomUUID(),
				...grant.actor,
			},
			sql<boolean>`true`,
		);
		held.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void revoking.catch(held.reject);
	const blocker = await held.promise;
	const reading = raceDb.transaction(async (tx) => {
		waiting.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		return listPublicRealmMembers(tx, outsider.direct, subject.record.id, {});
	});
	void reading.catch(waiting.reject);
	const denied = assert.rejects(reading, ManagementAuthorityDenied);
	void denied.catch(() => {});
	try {
		const pid = await waiting.promise;
		let blocked = false;
		for (let i = 0; i < 500; i++) {
			blocked =
				(
					await pool.query<{ blocked: boolean }>(
						"select $2::integer=any(pg_blocking_pids($1)) as blocked",
						[pid, blocker],
					)
				).rows[0]?.blocked ?? false;
			if (blocked) break;
			await setTimeout(10);
		}
		check(blocked, true, "roster hydration waits for the exact native binding revocation");
	} finally {
		release.resolve();
		await revoking;
		await denied;
		checks++;
	}
	const root = new URL("../../../", import.meta.url),
		sourceDigests: Record<string, string> = {};
	for (const path of [
		"services/main/scripts/check-realm-roster.ts",
		"services/main/scripts/native-enrollment-fixture.ts",
		"services/main/src/services/realms/roster.ts",
		"services/main/src/services/realms/roster-contracts.ts",
		"services/main/src/services/api/realms/schema.ts",
		"services/main/src/services/api/realms/schema.test.ts",
		"services/main/src/services/realms/membership.ts",
		"services/main/src/services/realms/membership-policy.ts",
		"services/main/src/services/api/realms/membership.ts",
		"services/main/src/services/participation/presentation.ts",
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
			sampleCandidates: 10001,
			backgroundCandidates: 100000,
			queryPlan,
			scope:
				"Native public/operational roster paging, private disclosure and binding revocation. Large candidates are inactive native heads; presentation and manager setup are privileged fixture operations.",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
	await observability.shutdown();
}
