import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { config as loadEnv } from "dotenv";
import { Client, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

import { parseFilterDocument } from "@rezics/filter";

import { canonicalRevisionJson, normalizeRevisionJson } from "../src/services/history/content";
import {
	migrateBlockDocument,
	migrateDockRevisionPayload,
	migrateLegacyZoneFilterDocument,
	migrateSharedSearchQueryDocument,
	migrateUnitLocalizationRevisionPayload,
	migrateUnitMainRevisionPayload,
	type MigrationResult,
} from "./filter-document-cutover";

loadEnv({
	path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env"),
	quiet: true,
});

const CutoverLockName = "rezics:filter-document-cutover:1.6.0";
const DefaultBatchSize = 500;
const MaximumBatchSize = 5_000;
const ProgressInterval = 100_000;

interface CutoverOptions {
	readonly batchSize: number;
	readonly confirmed: boolean;
}

interface CutoverCounts {
	docks: number;
	localizations: number;
	revisionContents: number;
	sharedQueries: number;
	zones: number;
}

interface RevisionContentRow extends QueryResultRow {
	readonly byteSize: number;
	readonly encoding: string;
	readonly id: string;
	readonly payload: unknown;
	readonly sha256: string;
}

interface StoredRevisionContent {
	readonly byteSize: number;
	readonly id: string;
}

type RevisionTransformer = (value: unknown) => MigrationResult<unknown>;

function parseOptions(args: readonly string[]): CutoverOptions {
	let batchSize = DefaultBatchSize;
	let confirmed = false;
	for (let index = 0; index < args.length; index += 1) {
		const argument = args[index];
		if (argument === "--yes") {
			confirmed = true;
			continue;
		}
		if (argument === "--batch-size") {
			const value = Number(args[index + 1]);
			if (!Number.isSafeInteger(value) || value < 1 || value > MaximumBatchSize)
				throw new TypeError(`--batch-size must be between 1 and ${MaximumBatchSize}`);
			batchSize = value;
			index += 1;
			continue;
		}
		throw new TypeError(`Unknown FilterDocument migration argument: ${argument}`);
	}
	return { batchSize, confirmed };
}

async function inTransaction<Value>(
	client: PoolClient | Client,
	operation: () => Promise<Value>,
): Promise<Value> {
	await client.query("begin");
	try {
		const value = await operation();
		await client.query("commit");
		return value;
	} catch (cause) {
		await client.query("rollback");
		throw cause;
	}
}

async function relationExists(client: Client, name: string): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		"select to_regclass($1) is not null as exists",
		[`public.${name}`],
	);
	return result.rows[0]?.exists === true;
}

async function columnExists(client: Client, table: string, column: string): Promise<boolean> {
	const result = await client.query<{ readonly exists: boolean }>(
		`select exists (
			select 1
			from information_schema.columns
			where table_schema = 'public' and table_name = $1 and column_name = $2
		) as exists`,
		[table, column],
	);
	return result.rows[0]?.exists === true;
}

function reportProgress(name: string, count: number): void {
	if (count > 0 && count % ProgressInterval === 0)
		console.info(`FilterDocument cutover ${name}: ${count.toLocaleString("en-US")}`);
}

async function assertRevisionRewritePrivilege(client: Client): Promise<void> {
	await client.query("begin");
	try {
		await client.query("set local session_replication_role = replica");
	} finally {
		await client.query("rollback");
	}
}

async function prepareZoneFilterColumn(client: Client): Promise<void> {
	if (!(await columnExists(client, "zone", "filter_document")))
		await client.query("alter table public.zone add column filter_document jsonb");
}

async function migrateZones(
	client: Client,
	batchSize: number,
	counts: CutoverCounts,
): Promise<void> {
	let cursor: string | null = null;
	while (true) {
		const rows = await inTransaction(client, async () => {
			const result = await client.query<{
				readonly boundaryDocument: unknown;
				readonly filterDocument: unknown | null;
				readonly id: string;
				readonly searchDocument: unknown | null;
				readonly searchEnabled: boolean | null;
			}>(
				`select
					z.id,
					z.boundary_document as "boundaryDocument",
					z.filter_document as "filterDocument",
					feature.enabled as "searchEnabled",
					search.document as "searchDocument"
				from public.zone z
				left join public.zone_search_feature feature on feature.zone_id = z.id
				left join public.search_document search
					on search.id = feature.search_document_id and search.deleted_at is null
				where ($1::uuid is null or z.id > $1::uuid)
				order by z.id
				limit $2
				for update of z`,
				[cursor, batchSize],
			);
			const updates: { readonly document: unknown; readonly id: string }[] = [];
			for (const row of result.rows) {
				const filterDocument = migrateLegacyZoneFilterDocument({
					boundaryDocument: row.boundaryDocument,
					...(row.searchDocument === null ? {} : { searchDocument: row.searchDocument }),
					searchEnabled: row.searchEnabled === true,
				});
				if (
					row.filterDocument === null ||
					canonicalRevisionJson(row.filterDocument) !== canonicalRevisionJson(filterDocument)
				) {
					updates.push({ id: row.id, document: filterDocument });
					counts.zones += 1;
				} else parseFilterDocument(row.filterDocument);
			}
			if (updates.length)
				await client.query(
					`update public.zone z
					set filter_document = updates.document
					from jsonb_to_recordset($1::jsonb) as updates(id uuid, document jsonb)
					where z.id = updates.id`,
					[JSON.stringify(updates)],
				);
			return result.rows;
		});
		if (!rows.length) break;
		cursor = rows.at(-1)!.id;
		reportProgress("Zones", counts.zones);
	}
}

async function migrateSharedQueries(
	client: Client,
	batchSize: number,
	counts: CutoverCounts,
): Promise<void> {
	let cursor: string | null = null;
	while (true) {
		const rows = await inTransaction(client, async () => {
			const result = await client.query<{
				readonly document: unknown;
				readonly id: string;
			}>(
				`select id, document
				from public.shared_search_query
				where ($1::uuid is null or id > $1::uuid)
				order by id
				limit $2
				for update`,
				[cursor, batchSize],
			);
			const updates: { readonly document: unknown; readonly id: string }[] = [];
			for (const row of result.rows) {
				const document = migrateSharedSearchQueryDocument(row.document);
				if (
					row.document === null ||
					typeof row.document !== "object" ||
					!("filterDocument" in row.document)
				) {
					updates.push({ id: row.id, document });
					counts.sharedQueries += 1;
				}
			}
			if (updates.length)
				await client.query(
					`update public.shared_search_query query
					set document = updates.document
					from jsonb_to_recordset($1::jsonb) as updates(id uuid, document jsonb)
					where query.id = updates.id`,
					[JSON.stringify(updates)],
				);
			return result.rows;
		});
		if (!rows.length) break;
		cursor = rows.at(-1)!.id;
		reportProgress("shared queries", counts.sharedQueries);
	}
}

async function migrateCurrentDocks(
	client: Client,
	batchSize: number,
	counts: CutoverCounts,
): Promise<void> {
	let cursor: string | null = null;
	while (true) {
		const rows = await inTransaction(client, async () => {
			const result = await client.query<{
				readonly document: unknown;
				readonly id: string;
			}>(
				`select dock.id, dock.document
				from public.unit_dock dock
				where ($1::uuid is null or dock.id > $1::uuid)
				order by dock.id
				limit $2
				for update of dock`,
				[cursor, batchSize],
			);
			const updates: { readonly document: unknown; readonly id: string }[] = [];
			for (const row of result.rows) {
				const document = migrateBlockDocument(row.document);
				if (!document.changed) continue;
				updates.push({ id: row.id, document: document.value });
				counts.docks += 1;
			}
			if (updates.length)
				await client.query(
					`update public.unit_dock dock
					set document = updates.document
					from jsonb_to_recordset($1::jsonb) as updates(id uuid, document jsonb)
					where dock.id = updates.id`,
					[JSON.stringify(updates)],
				);
			return result.rows;
		});
		if (!rows.length) break;
		cursor = rows.at(-1)!.id;
		reportProgress("current Docks", counts.docks);
	}
}

async function migrateCurrentBlockLocalizations(
	client: Client,
	batchSize: number,
	counts: CutoverCounts,
): Promise<void> {
	let cursorUnitId: string | null = null;
	let cursorLanguage: string | null = null;
	while (true) {
		const rows = await inTransaction(client, async () => {
			const result = await client.query<{
				readonly content: unknown | null;
				readonly language: string;
				readonly unitId: string;
			}>(
				`select
					unit_id as "unitId",
					language,
					content
				from public.unit_localization
				where content is not null
					and (
						$1::uuid is null
						or (unit_id, language) > ($1::uuid, $2::text)
					)
				order by unit_id, language
				limit $3
				for update`,
				[cursorUnitId, cursorLanguage, batchSize],
			);
			const updates: {
				readonly content: unknown;
				readonly language: string;
				readonly unitId: string;
			}[] = [];
			for (const row of result.rows) {
				const content = migrateBlockDocument(row.content);
				if (!content.changed) continue;
				updates.push({ unitId: row.unitId, language: row.language, content: content.value });
				counts.localizations += 1;
			}
			if (updates.length)
				await client.query(
					`update public.unit_localization localization
					set content = updates.content
					from jsonb_to_recordset($1::jsonb)
						as updates("unitId" uuid, language text, content jsonb)
					where localization.unit_id = updates."unitId"
						and localization.language = updates.language`,
					[JSON.stringify(updates)],
				);
			return result.rows;
		});
		if (!rows.length) break;
		const last = rows.at(-1)!;
		cursorUnitId = last.unitId;
		cursorLanguage = last.language;
		reportProgress("current Block localizations", counts.localizations);
	}
}

function revisionContentIdentity(payloadValue: unknown): {
	readonly byteSize: number;
	readonly payload: unknown;
	readonly sha256: string;
} {
	const payload = normalizeRevisionJson(payloadValue);
	const canonical = canonicalRevisionJson(payload);
	return {
		byteSize: Buffer.byteLength(canonical),
		payload,
		sha256: createHash("sha256").update(canonical).digest("hex"),
	};
}

async function findOrCreateFullRevisionContent(
	client: Client,
	model: string,
	payloadValue: unknown,
): Promise<StoredRevisionContent> {
	const identity = revisionContentIdentity(payloadValue);
	await client.query(
		`insert into public.revision_content (model, sha256, byte_size, encoding, base_content_id, delta_depth, payload)
		values ($1, $2, $3, 'full', null, 0, $4::jsonb)
		on conflict (model, sha256) do nothing`,
		[model, identity.sha256, identity.byteSize, JSON.stringify(identity.payload)],
	);
	const result = await client.query<
		StoredRevisionContent & QueryResultRow & { readonly payload: unknown }
	>(
		`select id, byte_size as "byteSize", payload
		from public.revision_content
		where model = $1 and sha256 = $2
		limit 1`,
		[model, identity.sha256],
	);
	const stored = result.rows[0];
	if (!stored) throw new Error("FilterDocument migration could not store revision content");
	if (canonicalRevisionJson(stored.payload) !== canonicalRevisionJson(identity.payload))
		throw new Error("FilterDocument migration detected a revision content hash collision");
	return stored;
}

async function rewireUnitRevisionContent(
	client: Client,
	oldContent: RevisionContentRow,
	newContent: StoredRevisionContent,
	batchSize: number,
): Promise<void> {
	const byteSizeDelta = newContent.byteSize - oldContent.byteSize;
	while (true) {
		const moved = await inTransaction(client, async () => {
			await client.query("set local session_replication_role = replica");
			const result = await client.query<{ readonly count: number }>(
				`with targets as materialized (
					select ctid, revision_id
					from public.unit_revision_slot
					where content_id = $1::uuid
					limit $3
					for update
				), moved as (
					update public.unit_revision_slot slot
					set content_id = $2::uuid
					from targets
					where slot.ctid = targets.ctid
					returning slot.revision_id
				), changed_revisions as (
					select revision_id, count(*)::integer as slot_count
					from moved
					group by revision_id
				), adjusted as (
					update public.unit_revision revision
					set byte_size = revision.byte_size + ($4::integer * changed_revisions.slot_count)
					from changed_revisions
					where revision.id = changed_revisions.revision_id
					returning revision.id
				)
				select count(*)::integer as count from moved`,
				[oldContent.id, newContent.id, batchSize, byteSizeDelta],
			);
			return result.rows[0]?.count ?? 0;
		});
		if (!moved) break;
	}
}

async function rewireDockRevisionContent(
	client: Client,
	oldContentId: string,
	newContentId: string,
	batchSize: number,
): Promise<void> {
	while (true) {
		const moved = await inTransaction(client, async () => {
			const result = await client.query<{ readonly count: number }>(
				`with targets as materialized (
					select ctid
					from public.dock_revision
					where content_id = $1::uuid
					limit $3
					for update
				), moved as (
					update public.dock_revision revision
					set content_id = $2::uuid
					from targets
					where revision.ctid = targets.ctid
					returning revision.id
				)
				select count(*)::integer as count from moved`,
				[oldContentId, newContentId, batchSize],
			);
			return result.rows[0]?.count ?? 0;
		});
		if (!moved) break;
	}
}

async function deleteObsoleteRevisionContent(client: Client, contentId: string): Promise<void> {
	await inTransaction(client, async () => {
		const referenceResult = await client.query<{ readonly referenced: boolean }>(
			`select
				exists (select 1 from public.unit_revision_slot where content_id = $1::uuid)
				or exists (select 1 from public.dock_revision where content_id = $1::uuid)
				or exists (select 1 from public.content_structure_revision where content_id = $1::uuid)
				or exists (select 1 from public.collection_structure_revision where content_id = $1::uuid)
				or exists (select 1 from public.search_document_revision where content_id = $1::uuid)
				or exists (select 1 from public.revision_content where base_content_id = $1::uuid)
				as referenced`,
			[contentId],
		);
		if (referenceResult.rows[0]?.referenced)
			throw new Error(`Obsolete revision content ${contentId} is still referenced`);
		await client.query("set local session_replication_role = replica");
		await client.query("delete from public.revision_content where id = $1::uuid", [contentId]);
	});
}

async function migrateRevisionContentModel(input: {
	readonly batchSize: number;
	readonly client: Client;
	readonly counts: CutoverCounts;
	readonly model: "rezics.unit.main.v1" | "rezics.unit.localization.v1" | "rezics.dock.v1";
	readonly transform: RevisionTransformer;
}): Promise<void> {
	let cursor: string | null = null;
	while (true) {
		const result: QueryResult<RevisionContentRow> = await input.client.query<RevisionContentRow>(
			`select
				id,
				sha256,
				byte_size as "byteSize",
				encoding,
				payload
			from public.revision_content
			where model = $1 and ($2::text is null or sha256 > $2)
			order by sha256
			limit $3`,
			[input.model, cursor, input.batchSize],
		);
		if (!result.rows.length) break;
		for (const oldContent of result.rows) {
			cursor = oldContent.sha256;
			const migrated = input.transform(oldContent.payload);
			if (!migrated.changed) continue;
			if (oldContent.encoding !== "full")
				throw new Error(
					`FilterDocument migration does not support ${input.model} delta content ${oldContent.id}`,
				);
			const newContent = await findOrCreateFullRevisionContent(
				input.client,
				input.model,
				migrated.value,
			);
			if (input.model === "rezics.dock.v1")
				await rewireDockRevisionContent(
					input.client,
					oldContent.id,
					newContent.id,
					input.batchSize,
				);
			else await rewireUnitRevisionContent(input.client, oldContent, newContent, input.batchSize);
			await deleteObsoleteRevisionContent(input.client, oldContent.id);
			input.counts.revisionContents += 1;
			reportProgress("historical revision documents", input.counts.revisionContents);
		}
	}
}

async function migrateRevisionContents(
	client: Client,
	batchSize: number,
	counts: CutoverCounts,
): Promise<void> {
	for (const migration of [
		{
			model: "rezics.unit.main.v1" as const,
			transform: migrateUnitMainRevisionPayload,
		},
		{
			model: "rezics.unit.localization.v1" as const,
			transform: migrateUnitLocalizationRevisionPayload,
		},
		{ model: "rezics.dock.v1" as const, transform: migrateDockRevisionPayload },
	])
		await migrateRevisionContentModel({ client, batchSize, counts, ...migration });
}

async function assertCutoverReady(client: Client): Promise<void> {
	const result = await client.query<{
		readonly invalidSharedQueries: boolean;
		readonly legacyDockSources: boolean;
		readonly legacyLocalizationSources: boolean;
		readonly legacyRevisionDocuments: boolean;
		readonly missingZoneFilters: boolean;
	}>(`select
		exists (select 1 from public.zone where filter_document is null)
			as "missingZoneFilters",
		exists (select 1 from public.shared_search_query
			where document ? 'version' or document ? 'template' or not (document ? 'filterDocument'))
			as "invalidSharedQueries",
		exists (select 1 from public.unit_dock dock
			where dock.document @? '$.** ? (@.kind == "template")')
			as "legacyDockSources",
		exists (select 1 from public.unit_localization localization
			where localization.content @? '$.** ? (@.kind == "template")')
			as "legacyLocalizationSources",
		exists (select 1 from public.revision_content
			where model in ('rezics.unit.main.v1', 'rezics.unit.localization.v1', 'rezics.dock.v1')
				and (
					payload @? '$.** ? (@.kind == "template")'
					or payload @? '$.** ? (exists(@.boundaryDocument))'
				)) as "legacyRevisionDocuments"`);
	const proof = result.rows[0];
	if (!proof) throw new Error("FilterDocument cutover verification returned no proof");
	const failures = Object.entries(proof).filter(([, failed]) => failed);
	if (failures.length)
		throw new Error(
			`FilterDocument cutover is incomplete: ${failures.map(([name]) => name).join(", ")}`,
		);
}

async function verifyCompletedSchema(client: Client): Promise<void> {
	if (!(await columnExists(client, "zone", "filter_document")))
		throw new Error("Completed schema is missing zone.filter_document");
	const result = await client.query<{ readonly invalid: boolean }>(
		`select exists (
			select 1 from public.zone
			where filter_document is null or jsonb_typeof(filter_document) <> 'object'
		) as invalid`,
	);
	if (result.rows[0]?.invalid !== false)
		throw new Error("Completed schema contains invalid Zone Filter documents");
}

async function runCutover(client: Client, options: CutoverOptions): Promise<CutoverCounts> {
	const counts: CutoverCounts = {
		docks: 0,
		localizations: 0,
		revisionContents: 0,
		sharedQueries: 0,
		zones: 0,
	};
	if (!(await relationExists(client, "zone"))) {
		console.info(
			"FilterDocument cutover: schema is not installed yet; Atlas will create it fresh.",
		);
		return counts;
	}
	const hasBoundary = await columnExists(client, "zone", "boundary_document");
	if (!hasBoundary) {
		await verifyCompletedSchema(client);
		console.info("FilterDocument cutover: database already uses the completed schema.");
		return counts;
	}
	for (const relation of [
		"search_document",
		"search_document_revision",
		"search_document_revision_head",
		"zone_search_feature",
	])
		if (!(await relationExists(client, relation)))
			throw new Error(`Legacy FilterDocument cutover requires public.${relation}`);

	await assertRevisionRewritePrivilege(client);
	await prepareZoneFilterColumn(client);
	await migrateZones(client, options.batchSize, counts);
	await migrateSharedQueries(client, options.batchSize, counts);
	await migrateCurrentDocks(client, options.batchSize, counts);
	await migrateCurrentBlockLocalizations(client, options.batchSize, counts);
	await migrateRevisionContents(client, options.batchSize, counts);
	await assertCutoverReady(client);
	return counts;
}

const options = parseOptions(process.argv.slice(2));
if (!options.confirmed)
	throw new Error(
		"FilterDocument production migration requires --yes; it rewrites persisted documents and history.",
	);
const databaseUrl = process.env.DATABASE_ADMIN_URL;
if (!databaseUrl) throw new Error("DATABASE_ADMIN_URL is required");
const client = new Client({
	connectionString: databaseUrl,
	application_name: "rezics-filter-cutover",
});

await client.connect();
try {
	await client.query("set lock_timeout = '5s'");
	await client.query("set statement_timeout = '30min'");
	await client.query("set idle_in_transaction_session_timeout = '60s'");
	await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [CutoverLockName]);
	try {
		const counts = await runCutover(client, options);
		console.info(
			`FilterDocument cutover ready: ${JSON.stringify(counts)}. Atlas may contract the legacy schema.`,
		);
	} finally {
		await client.query("select pg_advisory_unlock(hashtextextended($1, 0))", [CutoverLockName]);
	}
} finally {
	await client.end();
}
