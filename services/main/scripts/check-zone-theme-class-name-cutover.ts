import { Client } from "pg";

type Finding = Readonly<{
	id: string;
	surface: "dock" | "localization" | "revision-content" | "theme-css";
}>;

const connectionString = process.env.DATABASE_ADMIN_URL;
if (!connectionString) throw new Error("DATABASE_ADMIN_URL is required");

const batchFlagIndex = process.argv.indexOf("--batch-size");
const batchSize = batchFlagIndex < 0 ? 5_000 : Number(process.argv[batchFlagIndex + 1]);
if (!Number.isSafeInteger(batchSize) || batchSize < 100 || batchSize > 10_000)
	throw new RangeError("--batch-size must be an integer between 100 and 10000");

const findings: Finding[] = [];
const MaximumReportedFindings = 100;
let scannedRows = 0;

function record(surface: Finding["surface"], ids: readonly string[]): void {
	for (const id of ids)
		if (findings.length < MaximumReportedFindings) findings.push({ id, surface });
}

const client = new Client({ connectionString });
await client.connect();
try {
	await client.query("set default_transaction_read_only = on");
	await client.query("set statement_timeout = '30s'");

	let localizationCursor: Readonly<{ language: string; unitId: string }> | undefined;
	for (;;) {
		const result = localizationCursor
			? await client.query<{
					readonly hasStyleRoles: boolean | null;
					readonly language: string;
					readonly unitId: string;
				}>(
					`select unit_id::text as "unitId", language,
						content::text like '%"styleRoles"%' as "hasStyleRoles"
					 from public.unit_localization
					 where (unit_id, language) > ($1::uuid, $2::text)
					 order by unit_id, language limit $3`,
					[localizationCursor.unitId, localizationCursor.language, batchSize],
				)
			: await client.query<{
					readonly hasStyleRoles: boolean | null;
					readonly language: string;
					readonly unitId: string;
				}>(
					`select unit_id::text as "unitId", language,
						content::text like '%"styleRoles"%' as "hasStyleRoles"
					 from public.unit_localization
					 order by unit_id, language limit $1`,
					[batchSize],
				);
		scannedRows += result.rowCount ?? 0;
		record(
			"localization",
			result.rows
				.filter(({ hasStyleRoles }) => hasStyleRoles)
				.map(({ language, unitId }) => `${unitId}:${language}`),
		);
		const last = result.rows.at(-1);
		if (!last || result.rows.length < batchSize) break;
		localizationCursor = last;
	}

	const scanUuidKeyedSurface = async (
		surface: "dock" | "revision-content" | "theme-css",
		firstSql: string,
		nextSql: string,
	): Promise<void> => {
		let cursor: string | undefined;
		for (;;) {
			const result = await client.query<{ readonly found: boolean; readonly id: string }>(
				cursor ? nextSql : firstSql,
				cursor ? [cursor, batchSize] : [batchSize],
			);
			scannedRows += result.rowCount ?? 0;
			record(
				surface,
				result.rows.filter(({ found }) => found).map(({ id }) => id),
			);
			const last = result.rows.at(-1);
			if (!last || result.rows.length < batchSize) break;
			cursor = last.id;
		}
	};

	await scanUuidKeyedSurface(
		"dock",
		`select id::text, document::text like '%"styleRoles"%' as found
		 from public.unit_dock order by id limit $1`,
		`select id::text, document::text like '%"styleRoles"%' as found
		 from public.unit_dock where id > $1::uuid order by id limit $2`,
	);
	await scanUuidKeyedSurface(
		"revision-content",
		`select id::text, payload::text like '%"styleRoles"%' as found
		 from public.revision_content order by id limit $1`,
		`select id::text, payload::text like '%"styleRoles"%' as found
		 from public.revision_content where id > $1::uuid order by id limit $2`,
	);
	await scanUuidKeyedSurface(
		"theme-css",
		`select id::text, source_css ilike '%data-style-role%' as found
		 from public.zone_theme_revision order by id limit $1`,
		`select id::text, source_css ilike '%data-style-role%' as found
		 from public.zone_theme_revision where id > $1::uuid order by id limit $2`,
	);

	console.log(JSON.stringify({ findings, scannedRows }, null, 2));
	if (findings.length > 0)
		throw new Error(
			`Zone theme class-name cutover found ${findings.length}${findings.length === MaximumReportedFindings ? "+" : ""} legacy records`,
		);
} finally {
	await client.end();
}
