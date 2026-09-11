import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { setTimeout } from "node:timers/promises";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { serializeSignedCookie } from "better-call";
import { initializeObservability } from "@rezics/observability";
import { database } from "../src/services/database";
import {
	users,
	realm,
	realmMember,
	unitOwnership,
	unitAccessGrant,
	entityIdentity,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { Authorization } from "../src/services/authorization";
import { RealmCapabilityRequired } from "../src/services/authorization/errors";
import { lockUnitAccessState } from "../src/services/authorization/unit/access-lock";
import { updateEntityPresentation } from "../src/services/participation/presentation";
import type { ParticipationAuthority } from "../src/services/participation/policy";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
	"Realm roster requires a disposable loopback target",
);
const observability = initializeObservability({
	service: { name: "rezics-realm-roster-qualification", version: "1.0.0", environment: "tooling" },
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
		return {
			account,
			self,
			participation,
			authorization: new Authorization(self.id, account.id, participation),
		};
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
type Actor = Awaited<ReturnType<typeof actor>>;
async function ownedRealm(owner: Actor) {
	return database.transaction(async (tx) => {
		const [subject] = await tx
			.insert(realm)
			.values({ status: "published", publishedAt: new Date(), visibility: "public" })
			.returning();
		assert.ok(subject);
		await tx
			.insert(unitOwnership)
			.values({ unitId: subject.id, profileId: owner.self.id, assignedByProfileId: owner.self.id });
		return subject;
	});
}
async function request(
	realmId: string,
	cookie: string,
	expectedStatus = 200,
	query: Record<string, string> = {},
) {
	const search = new URLSearchParams(query);
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/realms/${realmId}/members?${search}`, {
			headers: { Cookie: cookie },
		}),
	);
	const text = await response.text();
	check(response.status, expectedStatus, `Realm roster ${search}: ${text.slice(0, 1500)}`);
	httpChecks++;
	return text ? JSON.parse(text) : null;
}
const owner = await actor("Roster owner"),
	guest = await actor("Public roster member"),
	outsider = await actor("Roster outsider");
const subject = await ownedRealm(owner);
await database.insert(realmMember).values([
	{ realmId: subject.id, profileId: owner.self.id, state: "active" },
	{ realmId: subject.id, profileId: guest.self.id, state: "active" },
]);
await database
	.update(users)
	.set({ name: "Private roster sign-in label" })
	.where(eq(users.id, guest.account.id));
let queryPlan: unknown;
try {
	const first = await request(subject.id, owner.cookie);
	check(
		first.items.find((item: { profileId: string }) => item.profileId === guest.self.id)?.name,
		"Public roster member",
		"roster uses native public Entity presentation",
	);
	check(
		JSON.stringify(first).includes("Private roster sign-in label"),
		false,
		"private Auth names are not roster labels",
	);
	check(first.nextCursor, null, "a complete roster has no continuation");
	check(
		first.items.find((item: { profileId: string }) => item.profileId === owner.self.id)?.isOwner,
		true,
		"owner identity is preserved",
	);
	await request(subject.id, outsider.cookie, 403);
	const unnamed = await actor("");
	await database
		.insert(realmMember)
		.values({ realmId: subject.id, profileId: unnamed.self.id, state: "pending" });
	const unnamedPage = await request(subject.id, owner.cookie, 200, { profileId: unnamed.self.id });
	check(
		unnamedPage.items.map((item: { name: string | null; language: string | null }) => ({
			name: item.name,
			language: item.language,
		})),
		[{ name: null, language: null }],
		"missing native presentation remains explicitly absent",
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
	await database
		.insert(realmMember)
		.values({ realmId: subject.id, profileId: localized.self.id, state: "active" });
	const localizedPage = await request(subject.id, owner.cookie, 200, {
		profileId: localized.self.id,
	});
	check(
		localizedPage.items[0]?.language,
		"sr-Latn-RS",
		"native BCP 47 tags are not truncated to the authoring-language enum",
	);
	check(localizedPage.items[0]?.name, "Član", "native regional presentation name");
	check(
		localizedPage.items[0]?.avatar,
		{ type: "emoji", emoji: "🦉" },
		"native avatar is hydrated with the roster",
	);
	await database
		.update(entityIdentity)
		.set({ visibility: "private" })
		.where(eq(entityIdentity.id, guest.self.id));
	const hidden = await request(subject.id, owner.cookie, 200, { profileId: guest.self.id });
	check(
		hidden.items.map(
			(item: { name: unknown; avatar: unknown; language: unknown; slugAddress: unknown }) => [
				item.name,
				item.avatar,
				item.language,
				item.slugAddress,
			],
		),
		[[null, null, null, null]],
		"roster permission does not disclose private Entity presentation or addresses",
	);

	const large = await ownedRealm(owner);
	const prefix = `00${crypto.randomUUID().replaceAll("-", "").slice(0, 6)}-${crypto.randomUUID().slice(0, 4)}`;
	await database.transaction(async (tx) => {
		await tx.execute(
			sql`insert into entity_identity(id,shape) select (${prefix} || '-8000-8000-' || lpad(to_hex(i),12,'0'))::uuid,'unresolved' from generate_series(1,10000) i`,
		);
		await tx.execute(
			sql`insert into realm_member(realm_id,profile_id,state) select ${large.id}::uuid,(${prefix} || '-8000-8000-' || lpad(to_hex(i),12,'0'))::uuid,'muted' from generate_series(1,10000) i`,
		);
		await tx
			.insert(realmMember)
			.values({ realmId: large.id, profileId: localized.self.id, state: "active" });
	});
	const seen = new Set<string>();
	let cursor: string | null = null,
		pages = 0,
		emptyContinuations = 0;
	do {
		const page = await request(large.id, owner.cookie, 200, {
			state: "active",
			limit: "2",
			...(cursor ? { afterProfileId: cursor } : {}),
		});
		if (!page.items.length && page.nextCursor) emptyContinuations++;
		for (const item of page.items) {
			assert.ok(!seen.has(item.profileId));
			seen.add(item.profileId);
		}
		if (page.nextCursor)
			assert.ok(
				!cursor || page.nextCursor > cursor,
				"cursor must advance over filtered candidates",
			);
		cursor = page.nextCursor;
		assert.ok(++pages <= 21, "roster scan must make bounded progress");
	} while (cursor);
	check(
		[...seen],
		[localized.self.id],
		"state-filtered paging reaches the matching tail member exactly once",
	);
	check(pages, 20, "each request scans at most 512 membership candidates");
	check(
		emptyContinuations,
		19,
		"empty filtered pages preserve a continuation instead of false exhaustion",
	);
	const dense = await request(large.id, owner.cookie, 200, { limit: "100" });
	const denseNext = await request(large.id, owner.cookie, 200, {
		limit: "100",
		afterProfileId: dense.nextCursor,
	});
	check(dense.items.length, 100, "requested page bound is respected");
	check(
		new Set([...dense.items, ...denseNext.items].map((item) => item.profileId)).size,
		200,
		"dense pages do not repeat or skip their cursor boundary",
	);

	const { listRealmMembers } = await import("../src/services/realms/roster");
	const queries: Array<{ query: string; params: unknown[] }> = [];
	const pool = new Pool({ connectionString: target.toString(), max: 3, statement_timeout: 14000 });
	const raceDb = drizzle({
		client: pool,
		logger: {
			logQuery(query, params) {
				if (
					query.includes('from "realm_member"') &&
					query.includes('order by "realm_member"."profile_id"')
				)
					queries.push({ query, params });
			},
		},
	});
	try {
		await pool.query("analyze realm_member");
		await raceDb.transaction((tx) =>
			listRealmMembers(tx, owner.authorization, large.id, { state: "active", limit: 2 }),
		);
		const candidate = queries.at(-1);
		assert.ok(candidate);
		const plan = await pool.query(
			`explain (analyze, buffers, format json) ${candidate.query}`,
			candidate.params,
		);
		const concentrated = plan.rows[0];
		check(
			JSON.stringify(concentrated).includes('"Node Type":"Sort"'),
			false,
			"a concentrated roster also uses an ordered index",
		);
		// One Realm dominates a tiny isolated database. Add other Realms so the
		// composite key is qualified with a selective Realm predicate as well.
		for (let index = 0; index < 10; index++) {
			const background = await ownedRealm(owner);
			await pool.query(
				"insert into realm_member(realm_id,profile_id,state) select $1,profile_id,'muted' from realm_member where realm_id=$2 order by profile_id limit 10000",
				[background.id, large.id],
			);
		}
		await pool.query("analyze realm_member");
		const selective = (
			await pool.query(
				`explain (analyze, buffers, format json) ${candidate.query}`,
				candidate.params,
			)
		).rows[0];
		queryPlan = { concentrated, selective };
		check(
			JSON.stringify(selective).includes("realm_member_pkey"),
			true,
			"the actual candidate query uses the Realm/member key among background rosters",
		);
		check(
			JSON.stringify(queryPlan).includes('"Node Type":"Sort"'),
			false,
			"candidate extraction avoids sorting the whole roster",
		);
		const [grant] = await database
			.insert(unitAccessGrant)
			.values({
				unitId: subject.id,
				subjectKind: "auth",
				authUserId: outsider.account.id,
				permission: "realm.members.read",
				scope: [],
				grantedByAuthUserId: owner.account.id,
			})
			.returning();
		assert.ok(grant);
		await outsider.authorization.realm.ensureCapability(subject.id, "realm.members.read");
		const held = Promise.withResolvers<number>(),
			release = Promise.withResolvers<void>(),
			waiting = Promise.withResolvers<number>();
		const revoke = raceDb.transaction(async (tx) => {
			await lockUnitAccessState(tx, [subject.id]);
			await tx
				.update(unitAccessGrant)
				.set({ revokedAt: new Date(), revokedByAuthUserId: owner.account.id })
				.where(eq(unitAccessGrant.id, grant.id));
			held.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			await release.promise;
		});
		void revoke.catch(held.reject);
		const blocker = await held.promise;
		const reading = raceDb.transaction(async (tx) => {
			waiting.resolve(
				(await tx.execute<{ pid: number }>(sql`select pg_backend_pid() as pid`)).rows[0]!.pid,
			);
			return listRealmMembers(tx, outsider.authorization, subject.id, {});
		});
		void reading.catch(waiting.reject);
		const denied = assert.rejects(reading, RealmCapabilityRequired);
		void denied.catch(() => {});
		try {
			const pid = await waiting.promise;
			let blocked = false;
			for (let attempt = 0; attempt < 500; attempt++) {
				blocked =
					(
						await pool.query<{ blocked: boolean }>(
							"select $2::integer = any(pg_blocking_pids($1)) as blocked",
							[pid, blocker],
						)
					).rows[0]?.blocked ?? false;
				if (blocked) break;
				await setTimeout(10);
			}
			check(blocked, true, "roster read waits for the exact authority revocation");
		} finally {
			release.resolve();
			await revoke;
			await denied;
			checks++;
		}
	} finally {
		await pool.end();
	}
} finally {
	await observability.shutdown();
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-realm-roster.ts",
	"services/main/src/services/realms/roster.ts",
	"services/main/src/services/realms/roster-contracts.ts",
	"services/main/src/services/realms/account.ts",
	"services/main/src/services/realms/membership.ts",
	"services/main/src/services/participation/presentation.ts",
	"services/main/src/services/units/slug-address.ts",
	"services/main/src/services/api/realms/index.ts",
	"services/main/src/services/api/realms/schema.ts",
	"services/main/src/services/api/schema/action-response.ts",
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
		sampleMembers: 10001,
		backgroundMembers: 100000,
		queryPlan,
		nativeRosterQualified: true,
	}),
);
console.info(
	`Verified ${checks} Realm roster assertions; generated actors and the 10,001-member sample remain only on the disposable target.`,
);
process.exit(0);
