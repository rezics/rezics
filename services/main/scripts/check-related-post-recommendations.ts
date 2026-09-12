import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { initializeObservability } from "@rezics/observability";
import { eq, sql } from "drizzle-orm";
import { Value } from "typebox/value";
import { database } from "../src/services/database";
import {
	users,
	post,
	postReply,
	unitLocalization,
	creditAttribution,
	accountPreference,
	recommendationSnapshot,
	DefaultContentRatingValues,
	ContentRatingValues,
} from "../src/services/database/schema";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import { createCatalogIdentity } from "../src/services/catalog/storage";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import {
	createRecommendationTracking,
	verifyRecommendationTracking,
} from "../src/services/recommendations/tracking";
import { createManagedOrganization } from "../src/services/participation/organizations";
import { PostFeedResponse } from "../src/services/api/schema/response";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
assert.equal(
	(await database.select().from(recommendationSnapshot).limit(1))[0],
	undefined,
	"The fixture qualifies the empty-snapshot fallback without replacing another generation",
);
const observability = initializeObservability({
	service: { name: "related-post-fixture", version: "1", environment: "tooling" },
});
const { searchGlobalIdentifiers } = await import("../src/services/search/service");
const person = await database.transaction(async (tx) => {
	const [account] = await tx
		.insert(users)
		.values({
			name: "Related post reader",
			email: `${crypto.randomUUID()}@example.invalid`,
			emailVerified: true,
		})
		.returning();
	assert.ok(account);
	const self = await ensureSelfEntityInTransaction(tx, account);
	return {
		account,
		self,
		authority: {
			principal: { kind: "auth" as const, authUserId: account.id },
			actingEntityId: self.id,
			authorizationRevision: self.authorizationRevision,
		},
	};
});
console.info(
	JSON.stringify({ fixtureActorId: person.account.id, disposableTarget: target.pathname }),
);
const subject = await database.transaction((tx) =>
	runWithParticipationAuthority(person.authority, () =>
		createCatalogIdentity(
			tx,
			{ owner: "publishing", shape: "work", status: "published", visibility: "public" },
			person.account.id,
		),
	),
);
let ordinal = 0,
	checks = 0,
	httpChecks = 0;
async function makePost(
	name: string,
	options: Partial<typeof post.$inferInsert> = {},
	root?: string,
) {
	return database.transaction(async (tx) => {
		const date = new Date(Date.now() - 3600000 - ordinal++ * 1000);
		const [row] = await tx
			.insert(post)
			.values({
				status: "published",
				visibility: "public",
				createdAt: date,
				updatedAt: date,
				publishedAt: date,
				createdByAuthUserId: person.account.id,
				...options,
				kind: root ? "reply" : (options.kind ?? "post"),
			})
			.returning();
		assert.ok(row);
		if (root) await tx.insert(postReply).values({ postId: row.id, rootPostId: root, depth: 0 });
		await tx.insert(unitLocalization).values({
			unitId: row.id,
			language: "en",
			title: name,
			summary: `Summary: ${name}`,
		});
		return row;
	});
}
const ratedSubject = await database.transaction((tx) =>
	runWithParticipationAuthority(person.authority, () =>
		createCatalogIdentity(
			tx,
			{
				owner: "publishing",
				shape: "work",
				status: "published",
				visibility: "public",
				contentRating: "r18",
			},
			person.account.id,
		),
	),
);
const seed = await makePost("Related seed", { subjectUnitId: subject.id });
const related = await makePost("Shared subject", { subjectUnitId: subject.id });
const credited = await makePost("Shared credit");
const organization = await database.transaction((tx) =>
	runWithParticipationAuthority(person.authority, () =>
		createManagedOrganization(tx, person.authority, {
			name: "Related credit organization",
			language: "en",
		}),
	),
);
await database.insert(creditAttribution).values(
	[seed, credited].map((row) => ({
		sourceUnitId: row.id,
		creditedEntityId: organization.entityId,
		role: "author" as const,
	})),
);
await database
	.insert(creditAttribution)
	.values({ sourceUnitId: seed.id, creditedEntityId: person.self.id, role: "author" });
const profileCredits = await searchGlobalIdentifiers({
	branches: [
		{
			category: "posts",
			sourceOwners: ["post"],
			sourceShapes: ["post"],
			searchExpression: { field: "credited-profile", operator: "equals", value: person.self.id },
		},
	],
	limit: 10,
	sort: "createdAt:desc",
});
assert.deepEqual(
	profileCredits.hits.map((item) => item.id),
	[seed.id],
);
checks++;
const organizationProfiles = await searchGlobalIdentifiers({
	branches: [
		{
			category: "posts",
			sourceOwners: ["post"],
			sourceShapes: ["post"],
			searchExpression: {
				field: "credited-profile",
				operator: "equals",
				value: organization.entityId,
			},
		},
	],
	limit: 10,
	sort: "createdAt:desc",
});
assert.equal(organizationProfiles.hits.length, 0);
checks++;
const ordinary = await makePost("Unrelated public post");
const reply = await makePost("Public reply", { subjectUnitId: subject.id }, related.id);
const hidden = await Promise.all([
	makePost("Private candidate", { visibility: "private", subjectUnitId: subject.id }),
	makePost("Unlisted candidate", { visibility: "unlisted", subjectUnitId: subject.id }),
	makePost("Draft candidate", { status: "draft", subjectUnitId: subject.id }),
	makePost("Removed candidate", { moderationStatus: "removed", subjectUnitId: subject.id }),
	makePost("Rated candidate", { contentRating: "r18", subjectUnitId: subject.id }),
]);
const privateRoot = await makePost("Private root", { visibility: "private" });
const hiddenReply = await makePost(
	"Private-root reply",
	{ subjectUnitId: subject.id },
	privateRoot.id,
);
const ratedRoot = await makePost("Rated root", { contentRating: "r18" });
const ratedReply = await makePost("Rated-root reply", { subjectUnitId: subject.id }, ratedRoot.id);
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const context = await auth.$context;
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
async function read(id = seed.id, query = "limit=50", authenticated = false) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/recommendations/posts/${id}?${query}`, {
			headers: authenticated ? { Cookie: cookie! } : {},
		}),
	);
	const body = await response.json();
	httpChecks++;
	assert.equal(response.status, 200, JSON.stringify(body));
	assert.ok(Value.Check(PostFeedResponse, body), JSON.stringify(body));
	checks++;
	return body;
}
async function reject(id: string, query: string, status: number, authenticated = false) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/recommendations/posts/${id}?${query}`, {
			headers: authenticated ? { Cookie: cookie! } : {},
		}),
	);
	assert.equal(response.status, status, await response.text());
	httpChecks++;
	checks++;
}
const firstReadStarted = performance.now();
const first = await read();
const firstReadMilliseconds = performance.now() - firstReadStarted;
const ids = first.items.map((item) => item.id);
for (const row of [seed, ...hidden, privateRoot, hiddenReply, ratedRoot, ratedReply]) {
	assert.ok(!ids.includes(row.id), `Unavailable candidate ${row.id} must be absent`);
	checks++;
}
for (const row of [related, credited, ordinary, reply]) {
	assert.ok(ids.includes(row.id));
	checks++;
}
assert.ok(
	ids.indexOf(credited.id) < ids.indexOf(ordinary.id),
	"Shared credit precedes general fallback",
);
checks++;
assert.ok(
	ids.indexOf(related.id) < ids.indexOf(ordinary.id),
	"Shared subject precedes general fallback",
);
checks++;
assert.equal(
	first.items.find((item) => item.id === reply.id)?.replyContext?.rootPostId,
	related.id,
);
checks++;
for (const item of first.items) {
	assert.ok(item.tracking);
	assert.ok(verifyRecommendationTracking(item.id, item.tracking));
	checks++;
}
const signed = await read(seed.id, "limit=50", true);
assert.deepEqual(
	signed.items.map((item) => item.id),
	ids,
);
checks++;
const page = await read(seed.id, "limit=2");
assert.ok(page.nextCursor);
const next = await read(seed.id, `limit=2&cursor=${encodeURIComponent(page.nextCursor)}`);
assert.deepEqual(
	[...page.items, ...next.items].map((item) => item.id),
	ids,
);
checks++;
await reject(seed.id, `limit=3&cursor=${encodeURIComponent(page.nextCursor)}`, 400);
await reject(ordinary.id, `limit=2&cursor=${encodeURIComponent(page.nextCursor)}`, 400);
await reject(privateRoot.id, "limit=5", 404);
await reject(hiddenReply.id, "limit=5", 404);
// A direct seed must be within the viewer's content-rating policy as well.
await reject(ratedRoot.id, "limit=5", 404);
const ratedUnitSeed = await api.fetch(
	new Request(
		`http://localhost:3001/api/v1/recommendations/units?owner=publishing&seedUnitId=${ratedSubject.id}`,
	),
);
assert.equal(ratedUnitSeed.status, 404, await ratedUnitSeed.text());
httpChecks++;
checks++;

await database
	.update(accountPreference)
	.set({ contentRatings: [...ContentRatingValues] })
	.where(eq(accountPreference.authUserId, person.account.id));
const expanded = await read(seed.id, "limit=50", true);
assert.ok(expanded.items.some((item) => item.id === ratedReply.id));
checks++;
await read(ratedRoot.id, "limit=5", true);
const allowedRatedUnitSeed = await api.fetch(
	new Request(
		`http://localhost:3001/api/v1/recommendations/units?owner=publishing&seedUnitId=${ratedSubject.id}`,
		{ headers: { Cookie: cookie! } },
	),
);
assert.equal(allowedRatedUnitSeed.status, 200, await allowedRatedUnitSeed.text());
httpChecks++;
checks++;
await database
	.update(accountPreference)
	.set({ contentRatings: [...DefaultContentRatingValues] })
	.where(eq(accountPreference.authUserId, person.account.id));
const beforeChoice = await read(seed.id, "limit=2", true);
assert.ok(beforeChoice.nextCursor);
const excluded = beforeChoice.items[1]!;
const tracking = createRecommendationTracking(excluded.id, {
	requestId: crypto.randomUUID(),
	surface: "post_related",
	position: 1,
	policyVersion: "native_best_v1",
});
const save = await api.fetch(
	new Request(`http://localhost:3001/api/v1/recommendations/exclusions/${excluded.id}`, {
		method: "PUT",
		headers: { Cookie: cookie!, "Content-Type": "application/json" },
		body: JSON.stringify({
			...tracking,
			eventId: crypto.randomUUID(),
			occurredAt: new Date().toISOString(),
		}),
	}),
);
assert.equal(save.status, 200, await save.text());
httpChecks++;
checks++;
assert.ok(!(await read(seed.id, "limit=50", true)).items.some((item) => item.id === excluded.id));
checks++;
assert.ok((await read()).items.some((item) => item.id === excluded.id));
checks++;
const afterChoice = await read(
	seed.id,
	`limit=2&cursor=${encodeURIComponent(beforeChoice.nextCursor)}`,
	true,
);
assert.deepEqual(
	afterChoice.items.map((item) => item.id),
	ids.slice(2),
);
checks++;
await database
	.update(accountPreference)
	.set({ personalizedFeed: false })
	.where(eq(accountPreference.authUserId, person.account.id));
assert.ok(!(await read(seed.id, "limit=50", true)).items.some((item) => item.id === excluded.id));
checks++;
// Current root visibility must still be rechecked for every reply.
const signedPage = await read(seed.id, "limit=2", true);
assert.ok(signedPage.nextCursor);
await database.update(post).set({ visibility: "private" }).where(eq(post.id, related.id));
const afterPrivate = await read();
assert.ok(!afterPrivate.items.some((item) => [related.id, reply.id].includes(item.id)));
checks++;
await database
	.update(post)
	.set({ visibility: "public", contentRating: "r18" })
	.where(eq(post.id, related.id));
assert.ok(!(await read()).items.some((item) => [related.id, reply.id].includes(item.id)));
checks++;
await database.update(post).set({ visibility: "private" }).where(eq(post.id, seed.id));
await reject(seed.id, "limit=5", 404);
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-related-post-recommendations.ts",
	"services/main/src/services/recommendations/related-posts.ts",
	"services/main/src/services/search/service.ts",
	"services/main/src/services/api/recommendations/index.ts",
	"services/main/src/services/api/feed/index.ts",
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
		checks,
		httpChecks,
		firstReadMilliseconds,
		runtime: (
			await database.execute(
				sql`select version() as postgres,current_setting('default_transaction_isolation') as isolation`,
			)
		).rows[0],
		viewerRatingPreferenceQualified: true,
		emptySnapshotFallback: true,
		currentRootDisclosure: true,
		fixtureDataRetained: true,
	}),
);
await database.$client.end();
await observability.shutdown();
