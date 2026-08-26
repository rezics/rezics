import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ContentPackInvalid, ContentPackSourceNotFound } from "./errors";
import { loadPack } from "./load-pack";
import { resolveShowcasePacksDir } from "./resolve-source";

const FixtureId = "checksum-fixture";
const FixtureUnitIds = {
	"fixture:software": "019c0000-0000-7000-8000-000000000001",
	"fixture:release": "019c0000-0000-7000-8000-000000000002",
	"fixture:video": "019c0000-0000-7000-8000-000000000003",
	"fixture:audio": "019c0000-0000-7000-8000-000000000004",
	"fixture:entity": "019c0000-0000-7000-8000-000000000005",
} as const;
const FixtureFieldRights = {
	path: "/localizations/0/description",
	rightsBasis: "source-specific",
	verificationStatus: "unverified",
	sourceUrl: "https://example.com/entity",
	attributionText: "The description has source-specific terms.",
} as const;

describe("loadPack", () => {
	it("validates and losslessly loads every pack document with a stable checksum", async () => {
		const fixture = await createFixture();
		try {
			const before = await loadPack(fixture.root, FixtureId);
			const repeated = await loadPack(fixture.root, FixtureId);
			expect(repeated.checksum).toBe(before.checksum);
			expect(before.objects.map(({ sourceKey }) => sourceKey)).toEqual([
				"fixture:software",
				"fixture:release",
				"fixture:video",
				"fixture:audio",
				"fixture:entity",
			]);
			expect(before.bindings).toEqual([
				{
					sourceKey: "fixture:binding",
					epubHref: "Text/chapter.xhtml#chapter",
					navPointId: "np-1",
				},
			]);
			expect(before.rights[0]?.fieldRights).toEqual([FixtureFieldRights]);
			expect(before.sourceLock.kind).toBe("local-epub");

			await writeJson(fixture.bindingsPath, [
				{
					sourceKey: "fixture:binding",
					epubHref: "Text/chapter.xhtml#chapter",
					navPointId: "np-2",
				},
			]);
			const withChangedBinding = await loadPack(fixture.root, FixtureId);
			expect(withChangedBinding.checksum).not.toBe(before.checksum);

			await writeJson(fixture.relationsPath, {
				subjects: [
					{
						sourceKey: "fixture:subject",
						unitSourceKey: "fixture:software",
						entitySourceKey: "fixture:entity",
						role: "about",
						contextPostSourceKey: null,
						position: "a0",
					},
				],
			});
			const after = await loadPack(fixture.root, FixtureId);
			expect(after.checksum).not.toBe(withChangedBinding.checksum);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects unknown object fields instead of stripping them", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.entitiesPath, [{ ...entityObject(), unexpected: true }]);
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/does not match the content-pack schema.*unexpected/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects duplicate localization languages before database mutation", async () => {
		const fixture = await createFixture();
		try {
			const object = entityObject();
			await writeJson(fixture.entitiesPath, [
				{ ...object, localizations: [...object.localizations, object.localizations[0]] },
			]);
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/each localization language only once/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects known non-Tag objects in direct applications and Path definitions", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.relationsPath, {
				unitTags: [
					{
						unitSourceKey: "fixture:software",
						tagSourceKey: "fixture:release",
						pinned: false,
						position: null,
					},
				],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/fixture:release is not a Tag/,
			);

			await writeJson(fixture.idsPath, {
				units: FixtureUnitIds,
				subjects: {
					"fixture:subject": "019c0000-0000-7000-8000-000000000006",
				},
				tagPaths: {
					"fixture:path": "019c0000-0000-7000-8000-000000000007",
				},
			});
			await writeJson(fixture.relationsPath, {
				tagPaths: [
					{
						sourceKey: "fixture:path",
						memberTagSourceKeys: ["fixture:software", "fixture:release"],
						sourceUrl: "https://example.com/path",
						sourceImportedAt: "2026-08-24T00:00:00Z",
					},
				],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/fixture:software is not a Tag and cannot be a Tag Path member/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects duplicate subject identities before relying on the database unique key", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.idsPath, {
				units: FixtureUnitIds,
				subjects: {
					"fixture:subject": "019c0000-0000-7000-8000-000000000006",
					"fixture:subject-duplicate": "019c0000-0000-7000-8000-000000000007",
				},
			});
			const identity = {
				unitSourceKey: "fixture:software",
				entitySourceKey: "fixture:entity",
				role: "about",
				contextPostSourceKey: null,
				position: "a0",
			};
			await writeJson(fixture.relationsPath, {
				subjects: [
					{ sourceKey: "fixture:subject", ...identity },
					{ sourceKey: "fixture:subject-duplicate", ...identity },
				],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/Duplicate subject association identity/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects partial importer judgment evidence", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.relationsPath, {
				unitTags: [
					{
						unitSourceKey: "fixture:software",
						tagSourceKey: "fixture:tag",
						pinned: false,
						position: null,
						fitVote: 1,
					},
				],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/Importer Tag judgment evidence requires fit, spoiler, provenance, and aggregate fields together/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects Tag application pinning that cannot satisfy the database contract", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.relationsPath, {
				unitTags: [
					{
						unitSourceKey: "fixture:software",
						tagSourceKey: "fixture:tag",
						pinned: false,
						position: "a0",
					},
				],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/Pinned Tag applications require a position; unpinned applications forbid one/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects duplicate or dangling field-scoped rights paths", async () => {
		const fixture = await createFixture();
		try {
			await writeJson(fixture.rightsPath, [
				{
					...rightsRecord(),
					fieldRights: [FixtureFieldRights, FixtureFieldRights],
				},
			]);
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/Field-scoped rights paths must be unique/,
			);

			await writeJson(fixture.rightsPath, [
				{
					...rightsRecord(),
					fieldRights: [{ ...FixtureFieldRights, path: "/localizations/9/description" }],
				},
			]);
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/field-scoped rights path does not exist/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it.each(["javascript:alert(1)", "../relative-source", "https://user:secret@example.com/entity"])(
		"rejects unsafe provenance URL %s",
		async (sourceUrl) => {
			const fixture = await createFixture();
			try {
				await writeJson(fixture.rightsPath, [
					{
						...rightsRecord(),
						fieldRights: [{ ...FixtureFieldRights, sourceUrl }],
					},
				]);
				await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
					/absolute HTTP\(S\) URL without embedded credentials|Invalid URL/,
				);
			} finally {
				await fixture.dispose();
			}
		},
	);

	it("validates and losslessly preserves source-lock rights qualifications", async () => {
		const fixture = await createFixture();
		try {
			const sourceLock = snapshotSourceLock();
			await writeJson(fixture.sourceLockPath, sourceLock);
			const pack = await loadPack(fixture.root, FixtureId);
			expect(pack.sourceLock).toEqual(sourceLock);

			await writeJson(fixture.sourceLockPath, {
				...sourceLock,
				rightsExceptions: [...sourceLock.rightsExceptions, sourceLock.rightsExceptions[0]],
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/Source rights exception fields must be unique/,
			);

			await writeJson(fixture.sourceLockPath, {
				...sourceLock,
				aggregation: {
					...sourceLock.aggregation,
					sourceUrl: "https://user:secret@example.com/formula",
				},
			});
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(
				/absolute HTTP\(S\) URL without embedded credentials/,
			);
		} finally {
			await fixture.dispose();
		}
	});

	it("rejects malformed JSON and unsafe pack IDs explicitly", async () => {
		const fixture = await createFixture();
		try {
			await expect(loadPack(fixture.root, "../checksum-fixture")).rejects.toBeInstanceOf(
				ContentPackInvalid,
			);
			await writeFile(fixture.sourceLockPath, "{", "utf8");
			await expect(loadPack(fixture.root, FixtureId)).rejects.toThrow(/is not valid JSON/);
		} finally {
			await fixture.dispose();
		}
	});

	it("loads all generated showcase contracts without dropping their extensions", async () => {
		let sourceRoot: string;
		try {
			sourceRoot = resolveShowcasePacksDir({});
		} catch (error) {
			if (error instanceof ContentPackSourceNotFound) return;
			throw error;
		}
		const [toaru, xuZhimo, vndb] = await Promise.all([
			loadPack(sourceRoot, "toaru-core"),
			loadPack(sourceRoot, "xu-zhimo"),
			loadPack(sourceRoot, "vndb-v11"),
		]);
		expect(toaru.manifest.id).toBe("toaru-core");
		expect(toaru.manifest.languages).toEqual(["ja", "zh"]);
		expect(
			toaru.objects.some((object) => object.sourceKey === "toaru:entity:character:kamijou-touma"),
		).toBe(true);
		expect(toaru.ids.units["toaru:entity:character:kamijou-touma"]).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
		);

		expect(xuZhimo.bindings).toHaveLength(389);
		expect(xuZhimo.objects.some((object) => object.labelSourceKey !== undefined)).toBe(true);

		expect(vndb.relations.tagPaths?.length ?? 0).toBeGreaterThan(0);
		expect(vndb.relations.tagPathApplications?.length ?? 0).toBeGreaterThan(0);
		expect(vndb.manifest.version).toBe("0.2.0");
		if (vndb.sourceLock.kind !== "snapshot-provenance")
			throw new Error("vndb-v11 must use snapshot provenance");
		expect(vndb.sourceLock.rightsExceptions).toEqual([
			expect.objectContaining({
				sourceField: "db/chars.description",
				verificationStatus: "unverified",
				sourceUrl: "https://vndb.org/d14",
			}),
		]);
		expect(vndb.sourceLock.aggregation).toEqual({
			name: "VNDB tag_vn_calc",
			sourceUrl:
				"https://code.blicky.net/yorhel/vndb/src/commit/514f2391cc12aa94ce420354863c52538641d9b1/sql/func.sql",
		});
		expect(vndb.objects.some((object) => (object.entityMeasurements?.length ?? 0) > 0)).toBe(true);
	});
});

async function createFixture() {
	const root = await mkdtemp(join(tmpdir(), "rezics-content-pack-"));
	const packDir = join(root, "packs", FixtureId);
	const contentDir = join(packDir, "content");
	const entitiesPath = join(contentDir, "entities.json");
	const idsPath = join(packDir, "ids.json");
	const relationsPath = join(contentDir, "relations.json");
	const bindingsPath = join(packDir, "bindings.json");
	const rightsPath = join(packDir, "rights.json");
	const sourceLockPath = join(packDir, "sources.lock.json");
	await mkdir(contentDir, { recursive: true });
	await Promise.all([
		writeJson(join(packDir, "pack.json"), { id: FixtureId, version: "1.0.0" }),
		writeJson(idsPath, {
			units: FixtureUnitIds,
			subjects: {
				"fixture:subject": "019c0000-0000-7000-8000-000000000006",
			},
		}),
		writeJson(rightsPath, [rightsRecord()]),
		writeJson(sourceLockPath, {
			kind: "local-epub",
			displayTitle: "Fixture EPUB",
			identifier: "fixture-epub",
			publisher: "Fixture Publisher",
			issuedOn: "2026-08-23",
			creators: ["Fixture Creator"],
			sha256: "1".repeat(64),
			byteLength: 1,
			role: "test input",
		}),
		writeJson(bindingsPath, [
			{
				sourceKey: "fixture:binding",
				epubHref: "Text/chapter.xhtml#chapter",
				navPointId: "np-1",
			},
		]),
		writeJson(join(contentDir, "software.json"), [
			packObject("fixture:software", "software", {
				software: { metadataOnly: true, versionLabel: "root" },
			}),
		]),
		writeJson(join(contentDir, "releases.json"), [
			packObject("fixture:release", "release", {
				release: { parentUnitSourceKey: "fixture:software", versionLabel: "1.0" },
			}),
		]),
		writeJson(join(contentDir, "video.json"), [
			packObject("fixture:video", "video", { video: { durationSeconds: 120 } }),
		]),
		writeJson(join(contentDir, "audio.json"), [
			packObject("fixture:audio", "audio", { audio: { durationSeconds: 120 } }),
		]),
		writeJson(entitiesPath, [entityObject()]),
		writeJson(relationsPath, { subjects: [] }),
	]);
	return {
		root,
		entitiesPath,
		idsPath,
		relationsPath,
		bindingsPath,
		rightsPath,
		sourceLockPath,
		dispose: () => rm(root, { recursive: true, force: true }),
	};
}

function packObject(sourceKey: string, kind: string, detail: Readonly<Record<string, unknown>>) {
	return {
		sourceKey,
		unit: {
			kind,
			status: "published",
			visibility: "public",
			contentRating: "general",
			aiDisclosure: "none",
			license: null,
			moderationStatus: "approved",
			postTargetingLocked: false,
		},
		import: { ownershipMode: "community_owned", actorKind: "import" },
		...detail,
		localizations: [{ language: "en", title: sourceKey }],
	};
}

function entityObject() {
	return {
		...packObject("fixture:entity", "entity", {
			entity: { kind: "character", verified: false },
		}),
		localizations: [
			{
				language: "en",
				title: "Fixture Entity",
				description: { _type: "portable-text", _key: "0123456789ab", content: [] },
			},
		],
	};
}

function rightsRecord() {
	return {
		sourceKey: "fixture:entity",
		rightsBasis: "fixture",
		jurisdiction: null,
		attributionText: "Fixture attribution",
		payloadSha256: "2".repeat(64),
		fieldRights: [FixtureFieldRights],
	};
}

function snapshotSourceLock() {
	return {
		kind: "snapshot-provenance" as const,
		license: {
			database: "ODbL-1.0",
			contents: "DbCL-1.0",
			sourceUrl: "https://example.com/license",
		},
		attribution: "Fixture snapshot attribution",
		sources: [
			{
				file: "fixture.sql",
				kind: "database-dump" as const,
				url: "https://example.com/fixture.sql",
				savedAt: "2026-08-23T08:00:10Z",
				sha256: "3".repeat(64),
			},
		],
		rightsExceptions: [
			{
				sourceField: "db/entities.description",
				rightsBasis: "source-specific",
				verificationStatus: "unverified" as const,
				sourceUrl: "https://example.com/rights",
				notice: "Descriptions have separately qualified rights.",
			},
		],
		aggregation: {
			name: "Fixture aggregate formula",
			sourceUrl: "https://example.com/formula",
		},
	};
}

function writeJson(filePath: string, value: unknown): Promise<void> {
	return writeFile(filePath, JSON.stringify(value), "utf8");
}
