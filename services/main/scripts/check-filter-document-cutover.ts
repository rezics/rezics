import { createHash } from "node:crypto";

import {
	DefaultBlockHostPolicy,
	assertDockDocument,
	assertUnitReferencedBlockDocument,
} from "@rezics/block";
import { parseFilterDocument, parseSharedSearchQueryDocument } from "@rezics/filter";
import { Client, type QueryResultRow } from "pg";

import { canonicalRevisionJson, normalizeRevisionJson } from "../src/services/history/content";

const FixtureFlag = "REZICS_DISPOSABLE_MIGRATION_FIXTURE";
const ZoneId = "70000000-0000-7000-8000-000000000001";
const SearchDocumentId = "70000000-0000-7000-8000-000000000002";
const DockId = "70000000-0000-7000-8000-000000000003";
const DockUnitId = "70000000-0000-7000-8000-000000000004";
const LocalizationUnitId = "70000000-0000-7000-8000-000000000005";
const SharedQueryId = "70000000-0000-7000-8000-000000000006";
const ProfileId = "70000000-0000-7000-8000-000000000007";
const MainRevisionId = "70000000-0000-7000-8000-000000000011";
const LocalizationRevisionId = "70000000-0000-7000-8000-000000000012";
const DockRevisionId = "70000000-0000-7000-8000-000000000013";
const SearchRevisionId = "70000000-0000-7000-8000-000000000014";
const MainContentId = "70000000-0000-7000-8000-000000000021";
const LocalizationContentId = "70000000-0000-7000-8000-000000000022";
const DockContentId = "70000000-0000-7000-8000-000000000023";
const SearchContentId = "70000000-0000-7000-8000-000000000024";
const Timestamp = "2026-08-11T00:00:00.000Z";

const WorkCategories = ["units", "posts", "reviews", "collections"] as const;
const BookWhere = {
	any: [
		{ kind: { in: ["book"] } },
		{ post: { is: { subject: { is: { kind: { in: ["book"] } } } } } },
		{ collection: { is: { items: { some: { kind: { in: ["book"] } } } } } },
	],
} as const;
const BoundaryDocument = {
	_type: "zone-boundary",
	_key: "b00757a70001",
	categories: [...WorkCategories],
	filter: BookWhere,
} as const;
const ThemeDocument = {
	_type: "zone-theme",
	_key: "b00757a70002",
	colorScheme: "system",
	accent: "#a16207",
	density: "comfortable",
} as const;
const LegacySearchDocument = {
	version: 1,
	template: { id: "book", version: 1 },
	categories: [...WorkCategories],
	controls: [
		{
			key: "language",
			field: "language",
			enabled: true,
			disclosure: "visible",
		},
		{
			key: "tag",
			field: "tag",
			enabled: false,
			disclosure: "visible",
		},
	],
	results: { maxPageSize: 1, maxResultWindow: 1 },
} as const;

function legacyFeedDocument(
	type: "block-document" | "dock-document",
	template: "book" | "media" | "realm" | "zone",
	key: string,
) {
	return {
		_type: type,
		_key: key,
		blocks: [
			{
				_type: "feed",
				_key: `${key.slice(0, 10)}01`,
				feature: { kind: "template", template },
				presentation: { pagination: "load-more", showResultCount: true },
			},
		],
	} as const;
}

const DockDocument = legacyFeedDocument("dock-document", "realm", "d00000000000");
const LocalizationDocument = legacyFeedDocument("block-document", "zone", "a00000000000");
const HistoricalDockDocument = legacyFeedDocument("dock-document", "book", "d10000000000");
const HistoricalLocalizationDocument = legacyFeedDocument(
	"block-document",
	"media",
	"a10000000000",
);

interface StoredContentFixture {
	readonly byteSize: number;
	readonly id: string;
	readonly model: string;
	readonly payload: unknown;
	readonly sha256: string;
}

function contentFixture(id: string, model: string, payloadValue: unknown): StoredContentFixture {
	const payload = normalizeRevisionJson(payloadValue);
	const canonical = canonicalRevisionJson(payload);
	return {
		id,
		model,
		payload,
		byteSize: Buffer.byteLength(canonical),
		sha256: createHash("sha256").update(canonical).digest("hex"),
	};
}

function assert(condition: unknown, message: string): asserts condition {
	if (!condition) throw new Error(message);
}

function assertEqual(actual: unknown, expected: unknown, message: string): void {
	assert(
		canonicalRevisionJson(actual) === canonicalRevisionJson(expected),
		`${message}: expected ${canonicalRevisionJson(expected)}, received ${canonicalRevisionJson(actual)}`,
	);
}

async function assertDisposableDatabase(client: Client): Promise<void> {
	assert(
		process.env[FixtureFlag] === "1",
		`${FixtureFlag}=1 is required because this check writes destructive fixtures`,
	);
	const result = await client.query<{ readonly database: string }>(
		"select current_database() as database",
	);
	assert(
		result.rows[0]?.database === "rezics_atlas",
		"FilterDocument cutover fixtures may run only in the disposable rezics_atlas database",
	);
}

async function relationExists(client: Client, relation: string): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		"select to_regclass($1) is not null as exists",
		[`public.${relation}`],
	);
	return result.rows[0]?.exists === true;
}

async function insertRevisionContent(client: Client, content: StoredContentFixture): Promise<void> {
	await client.query(
		`insert into public.revision_content
			(id, model, sha256, byte_size, encoding, base_content_id, delta_depth, payload)
		values ($1, $2, $3, $4, 'full', null, 0, $5::jsonb)`,
		[content.id, content.model, content.sha256, content.byteSize, JSON.stringify(content.payload)],
	);
}

async function seed(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	assert(await relationExists(client, "search_document"), "Seed requires the legacy schema");
	const existing = await client.query<{ readonly exists: boolean }>(
		"select exists (select 1 from public.zone where id = $1::uuid) as exists",
		[ZoneId],
	);
	assert(existing.rows[0]?.exists === false, "FilterDocument cutover fixture already exists");

	const mainContent = contentFixture(MainContentId, "rezics.unit.main.v1", {
		version: 1,
		kind: "zone",
		unit: {},
		extension: { boundaryDocument: BoundaryDocument, themeDocument: ThemeDocument },
	});
	const localizationContent = contentFixture(LocalizationContentId, "rezics.unit.localization.v1", {
		version: 1,
		localization: { language: "en", content: HistoricalLocalizationDocument },
	});
	const dockContent = contentFixture(DockContentId, "rezics.dock.v1", {
		version: 1,
		dock: {
			id: DockId,
			unitId: DockUnitId,
			kind: "main",
			document: HistoricalDockDocument,
			deletedAt: null,
			createdAt: Timestamp,
			updatedAt: Timestamp,
		},
	});
	const searchContent = contentFixture(SearchContentId, "rezics.search-document.v1", {
		version: 1,
		searchDocumentId: SearchDocumentId,
		document: LegacySearchDocument,
	});

	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
		await client.query(
			`insert into public.zone (id, boundary_document, theme_document)
			values ($1, $2::jsonb, $3::jsonb)`,
			[ZoneId, JSON.stringify(BoundaryDocument), JSON.stringify(ThemeDocument)],
		);
		await client.query(
			`insert into public.search_document (id, document)
			values ($1, $2::jsonb)`,
			[SearchDocumentId, JSON.stringify(LegacySearchDocument)],
		);
		await client.query(
			`insert into public.zone_search_feature (zone_id, search_document_id, enabled)
			values ($1, $2, true)`,
			[ZoneId, SearchDocumentId],
		);
		await client.query(
			`insert into public.shared_search_query (id, document, created_by_profile_id)
			values ($1, $2::jsonb, $3)`,
			[
				SharedQueryId,
				JSON.stringify({ version: 1, template: "zone", state: {}, selections: [] }),
				ProfileId,
			],
		);
		await client.query(
			`insert into public.unit_dock (id, unit_id, kind, document)
			values ($1, $2, 'main', $3::jsonb)`,
			[DockId, DockUnitId, JSON.stringify(DockDocument)],
		);
		await client.query(
			`insert into public.unit_localization
				(unit_id, language, content, content_status)
			values ($1, 'en', $2::jsonb, 'published')`,
			[LocalizationUnitId, JSON.stringify(LocalizationDocument)],
		);

		for (const content of [mainContent, localizationContent, dockContent, searchContent])
			await insertRevisionContent(client, content);

		await client.query(
			`insert into public.unit_revision (id, unit_id, byte_size)
			values ($1, $2, $3), ($4, $5, $6)`,
			[
				MainRevisionId,
				ZoneId,
				mainContent.byteSize,
				LocalizationRevisionId,
				LocalizationUnitId,
				localizationContent.byteSize,
			],
		);
		await client.query(
			`insert into public.unit_revision_slot
				(revision_id, unit_id, role, content_id, origin_revision_id, slot_key)
			values
				($1, $2, 'main', $3, $1, ''),
				($4, $5, 'localization', $6, $4, 'en')`,
			[
				MainRevisionId,
				ZoneId,
				MainContentId,
				LocalizationRevisionId,
				LocalizationUnitId,
				LocalizationContentId,
			],
		);
		await client.query(
			`insert into public.unit_revision_head (unit_id, revision_id)
			values ($1, $2), ($3, $4)`,
			[ZoneId, MainRevisionId, LocalizationUnitId, LocalizationRevisionId],
		);
		await client.query(
			`insert into public.dock_revision (id, dock_id, content_id, kind)
			values ($1, $2, $3, 'create')`,
			[DockRevisionId, DockId, DockContentId],
		);
		await client.query(
			`insert into public.dock_revision_head (dock_id, revision_id)
			values ($1, $2)`,
			[DockId, DockRevisionId],
		);
		await client.query(
			`insert into public.search_document_revision
				(id, search_document_id, content_id, kind)
			values ($1, $2, $3, 'create')`,
			[SearchRevisionId, SearchDocumentId, SearchContentId],
		);
		await client.query(
			`insert into public.search_document_revision_head (search_document_id, revision_id)
			values ($1, $2)`,
			[SearchDocumentId, SearchRevisionId],
		);
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
	console.info("Seeded legacy FilterDocument cutover fixtures.");
}

interface RevisionProjection extends QueryResultRow {
	readonly byteSize: number;
	readonly contentId: string;
	readonly payload: unknown;
}

async function readUnitRevision(client: Client, revisionId: string): Promise<RevisionProjection> {
	const result = await client.query<RevisionProjection>(
		`select
			slot.content_id as "contentId",
			content.payload,
			revision.byte_size as "byteSize"
		from public.unit_revision revision
		join public.unit_revision_slot slot on slot.revision_id = revision.id
		join public.revision_content content on content.id = slot.content_id
		where revision.id = $1`,
		[revisionId],
	);
	const row = result.rows[0];
	assert(row, `Missing migrated Unit revision ${revisionId}`);
	return row;
}

async function verifyAndClean(client: Client): Promise<void> {
	await assertDisposableDatabase(client);
	for (const relation of [
		"search_document",
		"search_document_revision",
		"search_document_revision_head",
		"zone_search_feature",
	])
		assert(!(await relationExists(client, relation)), `Legacy relation ${relation} still exists`);

	const zoneResult = await client.query<{ readonly filterDocument: unknown }>(
		`select filter_document as "filterDocument" from public.zone where id = $1`,
		[ZoneId],
	);
	const expectedZoneFilter = {
		categories: [...WorkCategories],
		where: BookWhere,
		controls: [{ key: "tag", enabled: false }],
	};
	assertEqual(
		parseFilterDocument(zoneResult.rows[0]?.filterDocument),
		expectedZoneFilter,
		"Zone FilterDocument migration mismatch",
	);

	const sharedResult = await client.query<{ readonly document: unknown }>(
		"select document from public.shared_search_query where id = $1",
		[SharedQueryId],
	);
	assertEqual(
		parseSharedSearchQueryDocument(sharedResult.rows[0]?.document),
		{
			filterDocument: { categories: ["units"], where: { kind: { in: ["zone"] } } },
			state: {},
			selections: [],
		},
		"Shared query migration mismatch",
	);

	const dockResult = await client.query<{ readonly document: unknown }>(
		"select document from public.unit_dock where id = $1",
		[DockId],
	);
	const migratedDock = dockResult.rows[0]?.document;
	assertDockDocument(migratedDock);
	assertEqual(
		migratedDock.blocks[0],
		{
			...DockDocument.blocks[0],
			feature: { kind: "inline", filterDocument: { categories: ["realms"] } },
		},
		"Non-Zone Dock Block migration mismatch",
	);

	const localizationResult = await client.query<{ readonly content: unknown }>(
		`select content from public.unit_localization
		where unit_id = $1 and language = 'en'`,
		[LocalizationUnitId],
	);
	const migratedLocalization = localizationResult.rows[0]?.content;
	assertUnitReferencedBlockDocument(migratedLocalization, DefaultBlockHostPolicy);
	assertEqual(
		migratedLocalization.blocks[0],
		{
			...LocalizationDocument.blocks[0],
			feature: {
				kind: "inline",
				filterDocument: {
					categories: ["units"],
					where: { kind: { in: ["zone"] } },
				},
			},
		},
		"Non-Zone Block localization migration mismatch",
	);

	const mainRevision = await readUnitRevision(client, MainRevisionId);
	assertEqual(
		mainRevision.payload,
		{
			version: 1,
			kind: "zone",
			unit: {},
			extension: {
				themeDocument: ThemeDocument,
				filterDocument: {
					categories: [...WorkCategories],
					where: BookWhere,
				},
			},
		},
		"Zone main revision migration mismatch",
	);
	const localizationRevision = await readUnitRevision(client, LocalizationRevisionId);
	assertEqual(
		localizationRevision.payload,
		{
			version: 1,
			localization: {
				language: "en",
				content: {
					...HistoricalLocalizationDocument,
					blocks: [
						{
							...HistoricalLocalizationDocument.blocks[0],
							feature: {
								kind: "inline",
								filterDocument: { categories: [...WorkCategories] },
							},
						},
					],
				},
			},
		},
		"Block localization revision migration mismatch",
	);

	const dockRevisionResult = await client.query<{
		readonly contentId: string;
		readonly payload: unknown;
	}>(
		`select revision.content_id as "contentId", content.payload
		from public.dock_revision revision
		join public.revision_content content on content.id = revision.content_id
		where revision.id = $1`,
		[DockRevisionId],
	);
	const dockRevision = dockRevisionResult.rows[0];
	assert(dockRevision, "Missing migrated Dock revision");
	assertEqual(
		dockRevision.payload,
		{
			version: 1,
			dock: {
				id: DockId,
				unitId: DockUnitId,
				kind: "main",
				document: {
					...HistoricalDockDocument,
					blocks: [
						{
							...HistoricalDockDocument.blocks[0],
							feature: {
								kind: "inline",
								filterDocument: { categories: [...WorkCategories] },
							},
						},
					],
				},
				deletedAt: null,
				createdAt: Timestamp,
				updatedAt: Timestamp,
			},
		},
		"Dock revision migration mismatch",
	);

	for (const revision of [mainRevision, localizationRevision]) {
		const sizeResult = await client.query<{ readonly byteSize: number }>(
			'select byte_size as "byteSize" from public.revision_content where id = $1',
			[revision.contentId],
		);
		assert(
			revision.byteSize === sizeResult.rows[0]?.byteSize,
			`Unit revision ${revision.contentId} byte size was not reconciled`,
		);
	}

	const obsoleteResult = await client.query<{ readonly count: string }>(
		"select count(*)::text as count from public.revision_content where id = any($1::uuid[])",
		[[MainContentId, LocalizationContentId, DockContentId, SearchContentId]],
	);
	assert(obsoleteResult.rows[0]?.count === "0", "Obsolete revision content was not removed");

	const proofResult = await client.query<{ readonly legacy: boolean }>(`select
		exists (
			select 1 from public.unit_dock
			where document @? '$.** ? (@.kind == "template")'
		)
		or exists (
			select 1 from public.unit_localization
			where content @? '$.** ? (@.kind == "template")'
		)
		or exists (
			select 1 from public.revision_content
			where payload @? '$.** ? (@.kind == "template")'
				or payload @? '$.** ? (exists(@.boundaryDocument))'
		) as legacy`);
	assert(proofResult.rows[0]?.legacy === false, "Legacy FilterDocument data remains");

	const migratedContentIds = [
		mainRevision.contentId,
		localizationRevision.contentId,
		dockRevision.contentId,
	];
	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
		await client.query("delete from public.shared_search_query where id = $1", [SharedQueryId]);
		await client.query("delete from public.unit_localization where unit_id = $1", [
			LocalizationUnitId,
		]);
		await client.query("delete from public.dock_revision_head where dock_id = $1", [DockId]);
		await client.query("delete from public.dock_revision where id = $1", [DockRevisionId]);
		await client.query("delete from public.unit_dock where id = $1", [DockId]);
		await client.query(
			"delete from public.unit_revision_head where revision_id = any($1::uuid[])",
			[[MainRevisionId, LocalizationRevisionId]],
		);
		await client.query(
			"delete from public.unit_revision_slot where revision_id = any($1::uuid[])",
			[[MainRevisionId, LocalizationRevisionId]],
		);
		await client.query("delete from public.unit_revision where id = any($1::uuid[])", [
			[MainRevisionId, LocalizationRevisionId],
		]);
		await client.query("delete from public.zone where id = $1", [ZoneId]);
		await client.query("delete from public.revision_content where id = any($1::uuid[])", [
			migratedContentIds,
		]);
		await client.query("commit");
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
	console.info("Verified and removed FilterDocument cutover fixtures.");
}

const mode = process.argv[2];
assert(mode === "seed" || mode === "verify-and-clean", "Expected seed or verify-and-clean");
const databaseUrl = process.env.DATABASE_ADMIN_URL;
assert(databaseUrl, "DATABASE_ADMIN_URL is required");
const client = new Client({
	connectionString: databaseUrl,
	application_name: "rezics-cutover-check",
});
await client.connect();
try {
	if (mode === "seed") await seed(client);
	else await verifyAndClean(client);
} finally {
	await client.end();
}
