import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { eq, sql } from "drizzle-orm";
import { initializeObservability } from "@rezics/observability";
import { database } from "../src/services/database";
import { users } from "../src/services/database/schema/auth";
import {
	recommendationSnapshot,
	unitBestScore,
} from "../src/services/database/schema/recommendation";
import { ensureSelfEntityInTransaction } from "../src/services/auth/entity";
import {
	createCatalogIdentity,
	recordCatalogChange,
	loadCatalogIdentity,
} from "../src/services/catalog/storage";
import {
	imageAsset,
	imageObject,
	imageAssetPresentation,
} from "../src/services/database/schema/image";
import { writeCatalogEditorial } from "../src/services/catalog/editorial";
import { addCatalogName } from "../src/services/catalog/names";
import { runWithParticipationAuthority } from "../src/services/participation/policy";
import { CatalogIdentityTables } from "../src/services/database/schema/catalog-identity";
import {
	admitRecommendationSnapshot,
	claimRecommendationPartition,
	advanceRecommendationPartition,
	finalizeRecommendationSnapshot,
} from "../src/services/recommendations/build-partitions";
import { verifyRecommendationTracking } from "../src/services/recommendations/tracking";
import { UnitRecommendationResponse } from "../src/services/api/recommendations/schema";
import { Value } from "typebox/value";

const target = new URL(process.env.DATABASE_URL ?? "http://invalid");
assert.ok(
	process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE === "1" &&
		["localhost", "127.0.0.1", "[::1]"].includes(target.hostname) &&
		target.port !== "15432" &&
		/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(target.pathname),
);
const [prior] = await database.select().from(recommendationSnapshot).limit(1);
assert.equal(prior, undefined, "Prepare an empty recommendation snapshot lane");
const observability = initializeObservability({
	service: { name: "recommendation-read-fixture", version: "1", environment: "tooling" },
});
const actor = await database.transaction(async (tx) => {
	const [account] = await tx
		.insert(users)
		.values({
			name: "Recommendation reader fixture",
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
const [cover] = await database.transaction(async (tx) => {
	const assets = await tx
		.insert(imageAsset)
		.values({
			ownerAuthUserId: actor.account.id,
			uploaderAuthUserId: actor.account.id,
			status: "ready",
			access: "public",
		})
		.returning();
	const asset = assets[0];
	assert.ok(asset);
	await tx.insert(imageObject).values({
		assetId: asset.id,
		storageKey: `fixture/recommendation/${asset.id}.png`,
		mediaType: "image/png",
		byteSize: 68,
		width: 1,
		height: 1,
	});
	await tx
		.insert(imageAssetPresentation)
		.values({ assetId: asset.id, role: "cover", fit: "contain" });
	return assets;
});
assert.ok(cover);
const works: Awaited<ReturnType<typeof createCatalogIdentity>>[] = [];
for (const [index, visibility, status] of [
	[0, "public", "published"],
	[1, "public", "published"],
	[2, "public", "published"],
	[3, "private", "published"],
	[4, "unlisted", "published"],
	[5, "public", "draft"],
	[6, "public", "published"],
	[7, "public", "published"],
] as const) {
	const work = await database.transaction((tx) =>
		runWithParticipationAuthority(actor.authority, async () => {
			const created = await createCatalogIdentity(
				tx,
				{
					owner: "publishing",
					shape: "work",
					status,
					visibility,
					moderationStatus: index === 6 ? "removed" : "approved",
					contentRating: index === 7 ? "r18" : "general",
				},
				actor.account.id,
			);
			const named = await addCatalogName(tx, created, actor.account.id, created.revision, {
				value: `Recommendation read ${index}`,
				kind: "primary",
				languageTag: "en",
				primaryForLanguage: true,
			});
			let revision = named.revision;
			if (index === 0) {
				revision = (
					await writeCatalogEditorial(tx, created, actor.account.id, "en", {
						expectedRevision: revision,
						expectedEditorialRevision: 0,
						content: {
							summary: "Native recommendation summary",
							description: null,
							avatar: null,
							bannerAssetId: null,
							coverAssetId: cover.id,
						},
					})
				).revision;
				revision = (
					await writeCatalogEditorial(tx, created, actor.account.id, "zh", {
						expectedRevision: revision,
						expectedEditorialRevision: 0,
						content: {
							summary: "本地摘要",
							description: null,
							avatar: null,
							bannerAssetId: null,
							coverAssetId: null,
						},
					})
				).revision;
			}
			return { ...created, revision };
		}),
	);
	works.push(work);
	await database.execute(sql`insert into recommendation_unit_signal_hourly(unit_id,bucket_start,kind,signal_count,weight)
  values(${work.id}::uuid,date_trunc('hour',clock_timestamp(),'UTC')-interval '1 hour','upvote',1,${1000 - index * 100})`);
}
const snapshot = await admitRecommendationSnapshot(database);
assert.ok(snapshot);
for (let page = 0; page < 128; page++) {
	const lease = await claimRecommendationPartition(database, snapshot);
	if (!lease) break;
	await advanceRecommendationPartition(database, lease);
}
assert.equal(await finalizeRecommendationSnapshot(database, snapshot), "ready");
const { default: api } = await import("../src/services/api");
api.compile();
const { auth } = await import("../src/services/auth");
const { serializeSignedCookie } = await import("better-call");
const context = await auth.$context;
const session = await context.internalAdapter.createSession(actor.account.id);
const [cookie] = (
	await serializeSignedCookie(
		context.authCookies.sessionToken.name,
		session.token,
		context.secret,
		{ path: "/" },
	)
).split(";");
assert.ok(cookie);
let checks = 0,
	httpChecks = 0;
async function read(query = "owner=publishing&shape=work&limit=3", authenticated = false) {
	const response = await api.fetch(
		new Request(`http://localhost:3001/api/v1/recommendations/units?${query}`, {
			headers: authenticated ? { Cookie: cookie! } : {},
		}),
	);
	const body = await response.json();
	assert.equal(response.status, 200, JSON.stringify(body));
	httpChecks++;
	assert.ok(Value.Check(UnitRecommendationResponse, body), JSON.stringify(body));
	checks++;
	return body;
}
const first = await read();
assert.deepEqual(
	first.items.map((item) => item.id),
	works.slice(0, 3).map((work) => work.id),
);
checks++;
assert.deepEqual(
	first.items.map((item) => item.title),
	["Recommendation read 0", "Recommendation read 1", "Recommendation read 2"],
);
checks++;
assert.equal(
	first.items[0]?.cover?.id,
	cover.id,
	"Native editorial cover must appear in recommendations",
);
checks++;
const localized = await read("owner=publishing&shape=work&limit=3&localizationLanguages=zh");
assert.equal(
	localized.items[0]?.cover?.id,
	cover.id,
	"Missing localized cover must fall back to an available native cover",
);
checks++;
assert.equal(
	localized.items[0]?.summary,
	"本地摘要",
	"Requested native editorial language must be honored independently from cover fallback",
);
checks++;
const paged = await read("owner=publishing&shape=work&limit=1");
assert.ok(paged.nextCursor);
checks++;
const continued = await read(
	`owner=publishing&shape=work&limit=1&cursor=${encodeURIComponent(paged.nextCursor)}`,
);
assert.equal(continued.items[0]?.id, works[1]!.id);
checks++;
const wrongCursor = await api.fetch(
	new Request(
		`http://localhost:3001/api/v1/recommendations/units?owner=publishing&shape=series&limit=1&cursor=${encodeURIComponent(paged.nextCursor)}`,
	),
);
assert.equal(wrongCursor.status, 400);
httpChecks++;
for (const item of first.items) {
	assert.ok(verifyRecommendationTracking(item.id, item.tracking));
	checks++;
}

const hidden = works[0]!;
const withdrawal = await database.transaction((tx) =>
	runWithParticipationAuthority(actor.authority, () =>
		writeCatalogEditorial(
			tx,
			hidden,
			actor.account.id,
			"en",
			{
				expectedRevision: hidden.revision,
				expectedEditorialRevision: 1,
				content: {
					summary: "Native recommendation summary",
					description: null,
					avatar: null,
					bannerAssetId: null,
					coverAssetId: cover.id,
				},
			},
			"withdrawn",
		),
	),
);
hidden.revision = withdrawal.revision;
const withoutCover = await read();
assert.equal(
	withoutCover.items.find((item) => item.id === hidden.id)?.cover,
	null,
	"Withdrawn editorial must not supply a native cover",
);
checks++;

const visibilityPage = await read("owner=publishing&shape=work&limit=1");
assert.ok(visibilityPage.nextCursor);
checks++;
await database.transaction((tx) =>
	runWithParticipationAuthority(actor.authority, async () => {
		await recordCatalogChange(tx, hidden, actor.account.id, hidden.revision, "fixture.visibility");
		await tx
			.update(CatalogIdentityTables.publishing)
			.set({ visibility: "private" })
			.where(eq(CatalogIdentityTables.publishing.id, hidden.id));
	}),
);
assert.equal(
	(await database.select().from(unitBestScore).where(eq(unitBestScore.unitId, hidden.id))).length,
	1,
	"The stale active score remains as the disclosure test input",
);
checks++;
const after = await read();
assert.ok(!after.items.some((item) => item.id === hidden.id));
checks++;
const own = await read(undefined, true);
assert.ok(
	!own.items.some((item) =>
		[hidden.id, ...works.slice(3).map((work) => work.id)].includes(item.id),
	),
);
checks++;
const hiddenAnchor = await api.fetch(
	new Request(
		`http://localhost:3001/api/v1/recommendations/units?owner=publishing&shape=work&limit=1&cursor=${encodeURIComponent(visibilityPage.nextCursor)}`,
	),
);
assert.equal(hiddenAnchor.status, 400);
httpChecks++;
const chosen = own.items.find((item) => item.id === works[1]!.id);
assert.ok(chosen);
const personalPage = await read("owner=publishing&shape=work&limit=1", true);
assert.equal(personalPage.items[0]?.id, chosen.id);
checks++;
assert.ok(personalPage.nextCursor);
const excluded = await api.fetch(
	new Request(`http://localhost:3001/api/v1/recommendations/exclusions/${chosen.id}`, {
		method: "PUT",
		headers: { Cookie: cookie!, "Content-Type": "application/json" },
		body: JSON.stringify({
			eventId: crypto.randomUUID(),
			occurredAt: new Date().toISOString(),
			...chosen.tracking,
		}),
	}),
);
assert.equal(excluded.status, 200, await excluded.text());
httpChecks++;
const personalContinuation = await read(
	`owner=publishing&shape=work&limit=1&cursor=${encodeURIComponent(personalPage.nextCursor)}`,
	true,
);
assert.equal(
	personalContinuation.items[0]?.id,
	works[2]!.id,
	"An excluded anchor must still locate the authenticated continuation",
);
checks++;
assert.ok(!(await read(undefined, true)).items.some((item) => item.id === chosen.id));
checks++;
assert.ok((await read()).items.some((item) => item.id === chosen.id));
checks++;
assert.ok(
	!(await read("owner=publishing&shape=work&limit=3&personalized=false", true)).items.some(
		(item) => item.id === chosen.id,
	),
);
checks++;
const restored = await api.fetch(
	new Request(`http://localhost:3001/api/v1/recommendations/exclusions/${chosen.id}`, {
		method: "DELETE",
		headers: { Cookie: cookie! },
	}),
);
assert.equal(restored.status, 200);
httpChecks++;
assert.ok((await read(undefined, true)).items.some((item) => item.id === chosen.id));
checks++;

for (const [work, patch] of [
	[works[1]!, { status: "archived" as const }],
	[works[2]!, { deletedAt: new Date() }],
] as const) {
	await database.transaction((tx) =>
		runWithParticipationAuthority(actor.authority, async () => {
			const current = await loadCatalogIdentity(tx, work, actor.account.id, true);
			await recordCatalogChange(tx, work, actor.account.id, current.revision, "fixture.read_state");
			await tx
				.update(CatalogIdentityTables.publishing)
				.set(patch)
				.where(eq(CatalogIdentityTables.publishing.id, work.id));
		}),
	);
	const result = await read();
	assert.ok(!result.items.some((item) => item.id === work.id));
	checks++;
}
const repository = new URL("../../../", import.meta.url),
	sourceDigests: Record<string, string> = {};
for (const path of [
	"services/main/scripts/check-recommendation-reads.ts",
	"services/main/src/services/recommendations/units.ts",
	"services/main/src/services/units/presentation-reader.ts",
	"services/main/src/services/recommendations/exclusion-query.ts",
	"services/main/src/services/api/recommendations/index.ts",
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
				sql`select version() as postgres,current_setting('default_transaction_isolation') as default_isolation`,
			)
		).rows[0],
		checks,
		httpChecks,
		currentPublicVisibilityChecked: true,
		nativeCoverFallback: true,
		cursorsAndTracking: true,
		privateExclusionIsolation: true,
		metadataOnlyImageFixture: true,
	}),
);
await database.$client.end();
await observability.shutdown();
