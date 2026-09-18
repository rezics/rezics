import assert from "node:assert/strict";
import { eq, sql } from "drizzle-orm";
import { initializeObservability } from "@rezics/observability";
import { PackObjectSchema, PackRelationsSchema } from "../src/services/content-pack/schemas";
import type { LoadedPack } from "../src/services/content-pack/contracts";

const connection = process.env.DATABASE_URL;
if (!connection || process.env.REZICS_DISPOSABLE_MIGRATION_FIXTURE !== "1")
	throw new Error("Explicit disposable fixture required");
const url = new URL(connection);
if (
	!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
	!/^\/rezics_atlas(?:_[a-z0-9_]+)?$/u.test(url.pathname) ||
	url.port === "15432"
)
	throw new Error("Isolated loopback Atlas target required");
const observability = initializeObservability({
	service: { name: "native-pack-fixture", version: "1.0.0", environment: "tooling" },
});
const { database } = await import("../src/services/database");
const { ensureBootstrapProfiles } = await import("../src/services/bootstrap/installation/profiles");
const { ensureSlugNamespaces } = await import("../src/services/bootstrap/installation/foundation");
const { ensureBootstrapPlatformAccess } = await import(
	"../src/services/bootstrap/installation/platform-access"
);
const { applyContentPack } = await import("../src/services/content-pack/apply");
const { verifyContentPack } = await import("../src/services/content-pack/verify");
const { readPackIdentities } = await import("../src/services/content-pack/identity");
const { readCatalogContentLanguageSupport } = await import(
	"../src/services/catalog/content-language-declaration"
);
const { BootstrapPlatformAdministratorProfile } = await import("../src/services/bootstrap/data");
const { withSeedAuthority } = await import("../src/services/seed/identity");
const { CatalogNameTables } = await import("@rezics/schema/postgres/knowledge/names");
const { CatalogFactTables } = await import("@rezics/schema/postgres/knowledge/facts");
const { authEntity } = await import("@rezics/schema/postgres/access/participation");
const lifecycle = {
	status: "published",
	visibility: "public",
	contentRating: "general",
	aiDisclosure: "unknown",
	license: null,
	moderationStatus: "approved",
	postTargetingLocked: false,
};
const keys = [
	"text",
	"work",
	"publication",
	"recording",
	"program",
	"software",
	"version",
	"character",
	"group",
	"concept",
	"package",
	"post",
	"collection",
	"audio",
] as const;
const ids = Object.fromEntries(
	keys.map((key, index) => [key, `019fff00-9999-7000-8000-${String(index + 1).padStart(12, "0")}`]),
);
const name = (value: string) => ({ languageTag: "en", value });
function native(key: string, owner: string, shape: string, value: unknown) {
	return PackObjectSchema.parse({
		sourceKey: key,
		identity: { owner, shape, ...lifecycle },
		native: value,
		import: { ownershipMode: "community_owned", actorKind: "import" },
		localizations: [{ language: "en", title: key }],
		...(key === "text"
			? { contentLanguageSupport: [{ languageTag: "en", channels: ["text"] }] }
			: {}),
	});
}
const objects = [
	native("version", "software", "version", {
		kind: "software_version",
		name: name("Translated version"),
		content: { owner: "software", id: ids.software },
		details: {
			kind: "translation",
			languageTag: "ja",
			distinguishingEvidence: "Independent fixture translation",
		},
	}),
	native("text", "publishing", "text_version", {
		kind: "text_version",
		name: name("Fixture text"),
		languageTag: "en",
	}),
	native("work", "publishing", "work", { kind: "publishing_work", name: name("Fixture work") }),
	native("publication", "publishing", "publication", {
		kind: "publication",
		name: name("Fixture edition"),
		pageCount: 200,
	}),
	native("recording", "music", "recording", {
		kind: "recording",
		name: name("Fixture recording"),
		lengthMilliseconds: 120000,
	}),
	native("program", "program", "program", {
		kind: "program",
		name: name("Fixture program"),
		structure: { shape: "program", fields: { declaredMainEpisodeCount: 12 } },
	}),
	native("software", "software", "content", {
		kind: "software_content",
		name: name("Fixture software"),
	}),
	native("character", "entity", "character", {
		kind: "entity",
		name: name("Fixture character"),
		shape: "character",
	}),
	native("group", "grouping", "grouping", { kind: "grouping", name: name("Fixture group") }),
	native("concept", "reference", "concept", {
		kind: "reference",
		name: name("Fixture concept"),
		profile: { shape: "concept" },
	}),
	native("package", "distribution", "package", {
		kind: "distribution",
		name: name("Fixture package"),
	}),
	...["post", "collection", "audio"].map((owner) =>
		PackObjectSchema.parse({
			sourceKey: owner,
			identity: { owner, shape: owner, ...lifecycle },
			import: { ownershipMode: "community_owned", actorKind: "import" },
			...(owner === "post"
				? { post: { kind: "post", subjectSourceKey: "text" } }
				: owner === "audio"
					? { audio: { durationSeconds: 60 } }
					: {}),
			localizations: [{ language: "en", title: owner }],
		}),
	),
];
const height = {
	namespace: "fixture.native_pack",
	key: "height",
	kind: "property",
	valueKind: "number",
	constraints: {
		targets: [{ owner: "entity", shapes: ["character"] }],
		integer: true,
		minimum: 1,
		unit: "mm",
	},
};
const pack: LoadedPack = {
	packDir: ".temp/native-pack-fixture",
	manifest: { id: "native-pack-fixture", version: "1.0.0" },
	checksum: "a".repeat(64),
	ids: { units: ids },
	rights: [],
	sourceLock: { kind: "cited-sources", retrievedOn: "2026-09-08", sources: [] },
	bindings: [],
	objects,
	relations: PackRelationsSchema.parse({
		catalogFacts: [
			{ sourceKey: "height", ownerSourceKey: "character", definition: height, value: 1700 },
		],
		catalogRelations: [
			{
				sourceSourceKey: "character",
				targetSourceKey: "software",
				definition: {
					namespace: "fixture.native_pack",
					key: "appears-in",
					kind: "predicate",
					valueKind: null,
					constraints: { targets: [{ owner: "entity", shapes: ["character"] }] },
				},
				roleDefinition: {
					namespace: "fixture.native_pack",
					key: "appearance-work",
					kind: "role",
					valueKind: null,
					constraints: { targets: [{ owner: "software", shapes: ["content"] }] },
				},
				qualifiers: [{ factSourceKey: "height", definition: height }],
			},
		],
	}),
	structures: [],
};
class RollbackQualification extends Error {}
let assertions = 0;
try {
	await database.transaction(async (tx) => {
		await ensureSlugNamespaces(tx);
		await ensureBootstrapProfiles(tx);
		await ensureBootstrapPlatformAccess(tx);
		assert.equal((await readPackIdentities(tx, pack)).length, 0);
		assertions++;
		assert.deepEqual(await applyContentPack(tx, pack, pack.packDir), {
			status: "created",
			created: 14,
		});
		assertions++;
		assert.deepEqual(await verifyContentPack(tx, pack), { ok: true, present: 14 });
		assertions++;
		assert.deepEqual(await applyContentPack(tx, pack, pack.packDir), {
			status: "noop",
			created: 0,
		});
		assertions++;
		const actual = await readPackIdentities(tx, pack);
		assert.equal(
			new Set(
				actual
					.filter(
						(entry) =>
							entry.owner !== "post" && entry.owner !== "collection" && entry.owner !== "audio",
					)
					.map((entry) => entry.owner),
			).size,
			8,
		);
		assertions++;
		for (const object of objects.filter((entry) => entry.native)) {
			const owner = object.native ? object.identity.owner : undefined;
			if (!owner || !(owner in CatalogNameTables)) throw new Error("Expected native fixture");
			// The closed native reference parser is the boundary for dynamic owner table selection.
			const { CatalogReferenceSchema } = await import("@rezics/reference");
			const reference = CatalogReferenceSchema.parse({ owner, id: ids[object.sourceKey] });
			const table = CatalogNameTables[reference.owner].name;
			assert.ok(
				(
					await tx
						.select({ id: table.id })
						.from(table)
						.where(eq(table.ownerId, reference.id))
						.limit(1)
				)[0],
			);
			assertions++;
		}
		assert.equal(
			(
				await tx
					.select({ id: authEntity.authUserId })
					.from(authEntity)
					.where(eq(authEntity.entityId, ids.character!))
			).length,
			0,
		);
		assertions++;
		const relation = CatalogFactTables.entity.relation;
		assert.equal(
			(
				await tx
					.select({ id: relation.id })
					.from(relation)
					.where(eq(relation.ownerId, ids.character!))
			).length,
			1,
		);
		assertions++;
		await withSeedAuthority(
			tx,
			BootstrapPlatformAdministratorProfile.profileId,
			async (authority) => {
				const declaration = await readCatalogContentLanguageSupport(
					tx,
					{ owner: "publishing", id: ids.text! },
					authority.principal.authUserId,
				);
				assert.equal(declaration.headVersion, 1);
				assert.deepEqual(declaration.value, [{ languageTag: "en", channels: ["text"] }]);
				assertions += 2;
			},
		);
		await tx.execute(sql`set constraints all immediate`);
		assertions++;
		throw new RollbackQualification();
	});
} catch (error) {
	if (!(error instanceof RollbackQualification)) throw error;
}
assert.equal((await database.transaction((tx) => readPackIdentities(tx, pack))).length, 0);
assertions++;
console.log(JSON.stringify({ ok: true, assertions, rollback: true }));
await observability.shutdown();
process.exit(0);
