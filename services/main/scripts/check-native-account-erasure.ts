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
import { database, type DatabaseTransaction } from "../src/services/database";
import { users, sessions, entityIdentity, realm } from "../src/services/database/schema";
import { authEntity, accountErasure } from "@rezics/schema/postgres/access/participation";
import { accountPreference } from "@rezics/schema/postgres/identity/account-preference";
import { PrincipalRequestContext } from "../src/services/auth/principal-context";
import { CredentialControlFreshAgeSeconds } from "../src/services/auth/credential-policy";
import {
	CredentialAuthorityDenied,
	readFirstPartyCredentialAuthority,
} from "../src/services/auth/credential-authority";
import {
	assertNativeEnrollmentFixture,
	fixturePrincipalContext,
} from "./native-enrollment-fixture";

assertNativeEnrollmentFixture();
const observability = initializeObservability({
	service: { name: "rezics-native-account-erasure", version: "1.0.0", environment: "tooling" },
});
const { auth } = await import("../src/services/auth");
const { default: api } = await import("../src/services/api");
const { eraseOwnAccount, dispatchAccountErasureBatch } = await import(
	"../src/services/participation/erasure"
);
const { joinRealm } = await import("../src/services/realms/membership");
api.compile();
const authContext = await auth.$context;
const pool = new Pool({
	connectionString: process.env.DATABASE_URL,
	max: 4,
	statement_timeout: 15000,
});
const raceDb = drizzle({ client: pool });
let assertions = 0,
	httpChecks = 0;
const check = (actual: unknown, expected: unknown, message: string) => {
	assert.deepEqual(actual, expected, message);
	assertions++;
};
async function actor(verified = false, freshRemainingMs?: number) {
	const [account] = await database
		.insert(users)
		.values({
			name: "Private erasure fixture",
			email: `${randomUUID()}@erasure.invalid`,
			emailVerified: verified,
		})
		.returning();
	assert.ok(account);
	const session =
		freshRemainingMs === undefined
			? await authContext.internalAdapter.createSession(account.id)
			: (
					await database
						.insert(sessions)
						.values({
							userId: account.id,
							token: randomUUID(),
							createdAt: new Date(
								Date.now() - CredentialControlFreshAgeSeconds * 1000 + freshRemainingMs,
							),
							expiresAt: new Date(Date.now() + 60_000),
						})
						.returning()
				)[0];
	assert.ok(session);
	const context = fixturePrincipalContext(session);
	const [cookie] = (
		await serializeSignedCookie(
			authContext.authCookies.sessionToken.name,
			session.token,
			authContext.secret,
			{ path: "/" },
		)
	).split(";");
	assert.ok(cookie);
	return { account, session, context, cookie };
}
type Actor = Awaited<ReturnType<typeof actor>>;
async function request(
	person: Actor,
	path: string,
	status: number,
	body?: unknown,
	headers: Record<string, string> = {},
) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1${path}`, {
			method: "POST",
			headers: {
				Cookie: person.cookie,
				"X-Rezics-Authority": JSON.stringify(person.context.selection),
				...(body === undefined ? {} : { "Content-Type": "application/json" }),
				...headers,
			},
			...(body === undefined ? {} : { body: JSON.stringify(body) }),
		}),
	);
	const text = await response.text();
	check(response.status, status, `${path}: ${text.slice(0, 1400)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
async function drain(id: string) {
	for (let round = 0; round < 150; round++) {
		await database
			.update(accountErasure)
			.set({ availableAt: new Date(0) })
			.where(eq(accountErasure.authUserId, id));
		const deleted = await dispatchAccountErasureBatch({ authUserId: id });
		assert.ok(deleted >= 0 && deleted <= 500);
		assertions++;
		const [job] = await database
			.select()
			.from(accountErasure)
			.where(eq(accountErasure.authUserId, id));
		if (job?.stage === "complete") {
			check(
				[job.selfEntityId, job.priorEmail],
				[null, null],
				"completion clears retained private deletion keys",
			);
			check(
				await dispatchAccountErasureBatch({ authUserId: id }),
				0,
				"completed jobs do not repeat effects",
			);
			return;
		}
	}
	throw new Error("Native account erasure did not finish its bounded stages");
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
			assertions++;
			return;
		}
		await setTimeout(10);
	}
	throw new Error("Expected the account erasure source fence");
}
async function race<Result>(
	writer: (tx: DatabaseTransaction) => Promise<unknown>,
	reader: (tx: DatabaseTransaction) => Promise<Result>,
	observe: (result: Promise<Result>) => Promise<unknown>,
	holdAfterBlockedMs = 0,
) {
	const ready = Promise.withResolvers<number>(),
		release = Promise.withResolvers<void>(),
		started = Promise.withResolvers<number>();
	const writing = raceDb.transaction(async (tx) => {
		await writer(tx);
		ready.resolve(
			(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
		);
		await release.promise;
	});
	void writing.catch(ready.reject);
	const holder = await ready.promise;
	const reading = raceDb.transaction(async (tx) => {
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
		if (holdAfterBlockedMs) await setTimeout(holdAfterBlockedMs);
	} finally {
		release.resolve();
		await writing;
		await observed;
	}
}
const credential = (tx: DatabaseTransaction, person: Actor) =>
	readFirstPartyCredentialAuthority(tx, {
		proof: person.context.credentialProof(),
		selection: person.context.selection,
		apiPermission: "account:read",
		requireFreshSession: false,
		requireVerifiedEmail: false,
	});
try {
	const privateOnly = await actor();
	check(
		(
			await database
				.select()
				.from(authEntity)
				.where(eq(authEntity.authUserId, privateOnly.account.id))
		).length,
		0,
		"a private account starts without Self",
	);
	await request(privateOnly, "/participation/account/erase", 401, undefined, {
		Authorization: "Bearer rz_api_invalid_fixture_key",
	});
	check(
		(
			await database
				.select()
				.from(accountErasure)
				.where(eq(accountErasure.authUserId, privateOnly.account.id))
		).length,
		0,
		"an explicit bearer cannot fall through to the valid cookie",
	);
	check(
		await request(privateOnly, "/participation/account/erase", 200),
		{ state: "erasing" },
		"an unverified private account can erase with its own fresh session",
	);
	const [queued] = await database
		.select()
		.from(accountErasure)
		.where(eq(accountErasure.authUserId, privateOnly.account.id));
	assert.ok(queued);
	check(queued.selfEntityId, null, "no public Self is manufactured for the erasure job");
	check(
		(
			await database
				.select()
				.from(entityIdentity)
				.where(eq(entityIdentity.createdByAuthUserId, privateOnly.account.id))
				.limit(1)
		).length,
		0,
		"the erasure route does not create public identity",
	);
	await drain(privateOnly.account.id);
	check(
		(await database.select().from(sessions).where(eq(sessions.userId, privateOnly.account.id)))
			.length,
		0,
		"all private sessions are drained",
	);

	const publicAuthor = await actor(true);
	const identity = z
		.object({
			entityId: z.uuid(),
			representation: z.object({ id: z.uuid(), revision: z.number() }),
		})
		.parse(
			await request(publicAuthor, "/account/identities", 200, {
				operationId: randomUUID(),
				names: [{ language: "en", value: "Retained public author" }],
				main: { expectedVersion: 0 },
			}),
		);
	const represented = {
		...publicAuthor,
		context: new PrincipalRequestContext(
			publicAuthor.account.id,
			{
				mode: "represented",
				entityId: identity.entityId,
				representations: [identity.representation],
			},
			publicAuthor.context.credentialProof(),
		),
	};
	await request(represented, "/participation/account/erase", 403);
	check(
		(await database.select().from(users).where(eq(users.id, publicAuthor.account.id)))[0]?.erasedAt,
		null,
		"represented authority cannot erase an operator account",
	);
	await request(publicAuthor, "/participation/account/erase", 200);
	await drain(publicAuthor.account.id);
	check(
		(await database.select().from(entityIdentity).where(eq(entityIdentity.id, identity.entityId)))
			.length,
		1,
		"published identity survives private operator erasure",
	);
	await assert.rejects(
		database.transaction((tx) => credential(tx, publicAuthor)),
		CredentialAuthorityDenied,
	);
	assertions++;

	const rotating = await actor();
	await database
		.update(sessions)
		.set({ token: randomUUID() })
		.where(eq(sessions.id, rotating.session.id));
	await assert.rejects(
		database.transaction((tx) => eraseOwnAccount(tx, rotating.context)),
		CredentialAuthorityDenied,
	);
	assertions++;
	check(
		(
			await database
				.select()
				.from(accountErasure)
				.where(eq(accountErasure.authUserId, rotating.account.id))
		).length,
		0,
		"same-ID credential rotation leaves no partial job",
	);
	const waiting = await actor(false, 2000);
	await database.transaction((tx) =>
		readFirstPartyCredentialAuthority(tx, {
			proof: waiting.context.credentialProof(),
			selection: waiting.context.selection,
			apiPermission: null,
			requireFreshSession: true,
			requireVerifiedEmail: false,
		}),
	);
	await race(
		async (tx) => {
			await tx.execute(
				sql`select id from ${users} where ${users.id}=${waiting.account.id} for update`,
			);
		},
		(tx) => eraseOwnAccount(tx, waiting.context),
		(result) => assert.rejects(result, CredentialAuthorityDenied),
		2100,
	);
	assertions++;
	check(
		(await database.select().from(users).where(eq(users.id, waiting.account.id)))[0]?.erasedAt,
		null,
		"freshness is checked after the account lock wait",
	);

	const consumer = await actor();
	await race(
		async (tx) => {
			await credential(tx, consumer);
			await tx.insert(accountPreference).values({ authUserId: consumer.account.id });
		},
		(tx) => eraseOwnAccount(tx, consumer.context),
		async (result) =>
			check(
				await result,
				{ state: "erasing" },
				"a credential-protected effect commits before a waiting erasure",
			),
	);
	await drain(consumer.account.id);
	check(
		(
			await database
				.select()
				.from(accountPreference)
				.where(eq(accountPreference.authUserId, consumer.account.id))
		).length,
		0,
		"erasure subsequently removes the committed private preference",
	);
	const eraseFirst = await actor();
	await race(
		(tx) => eraseOwnAccount(tx, eraseFirst.context),
		(tx) => credential(tx, eraseFirst),
		(result) => assert.rejects(result, CredentialAuthorityDenied),
	);
	assertions++;
	await drain(eraseFirst.account.id);

	const member = await actor(true);
	const [community] = await database
		.insert(realm)
		.values({ status: "published", visibility: "public", publishedAt: new Date() })
		.returning();
	assert.ok(community);
	const membership = await database.transaction((tx) =>
		joinRealm(tx, member.context, community.id, {
			operationId: randomUUID(),
			expectedControlRevision: community.membershipControlRevision,
			expectedRevision: 0,
			expectedMembershipVersion: 0,
			expectedEnforcementRevision: 0,
			consent: true,
			ruleRevisionId: null,
		}),
	);
	assert.ok(membership.activeGeneration);
	await request(member, "/participation/account/erase", 200);
	await drain(member.account.id);
	const retained = (
		await database.execute<{
			active_generation: number | null;
			consent: unknown;
			notification_basis: unknown;
		}>(
			sql`select m.active_generation,e.consent,e.notification_basis from public.access_membership m join public.realm_enrollment e on e.membership_id=m.id where m.id=${membership.membershipId}::uuid`,
		)
	).rows[0];
	check(
		retained,
		{ active_generation: null, consent: null, notification_basis: null },
		"private Realm admission and private evidence are closed without a Self",
	);

	const sources: Record<string, string> = {};
	const root = new URL("../../../", import.meta.url);
	for (const path of [
		"services/main/scripts/check-native-account-erasure.ts",
		"services/main/src/services/participation/erasure.ts",
		"services/main/src/services/api/participation/index.ts",
		"services/main/src/services/auth/principal-context.ts",
		"services/main/src/services/auth/credential-authority.ts",
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
				"Native direct-principal erasure, no-Self worker completion, credential races, preserved public identity and private Realm cleanup; no full recovery/capacity qualification",
		}),
	);
} finally {
	await pool.end();
	await database.$client.end();
	await observability.shutdown();
}
