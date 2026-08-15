import { initializeObservability } from "@rezics/observability";
import { Client } from "pg";

import { OfficialProfileIds } from "../src/services/bootstrap/data";
import { RezicsVersion } from "../src/version";
import {
	parseScaleSeedOptions,
	scaleSeedTitlePrefix,
	type ScaleSeedDistribution,
	type ScaleSeedSeedOptions,
	type ScaleSeedPurgeOptions,
} from "../src/services/scale-seed/contracts";
import { adminDatabaseUrl } from "./admin-database";

const observability = initializeObservability({
	service: {
		name: "rezics-scale-seed",
		version: RezicsVersion,
		environment: process.env.DEPLOYMENT_ENVIRONMENT ?? process.env.NODE_ENV ?? "development",
	},
});

const LocalDatabaseHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const ScaleSeedOwnerProfileId = OfficialProfileIds.community;

type QueryValue = string | number | null;

function assertLocalDatabase(): void {
	const url = new URL(adminDatabaseUrl);
	if (!LocalDatabaseHosts.has(url.hostname))
		throw new Error(`Scale seed is local-only; refusing database host ${url.hostname}`);
}

function distributionBoundaries(distribution: ScaleSeedDistribution): readonly [number, number] {
	return [distribution.book, distribution.book + distribution.software];
}

function scaleSeedPolicyVersion(runId: string): string {
	return `scale-seed-v1:${runId}`;
}

function generatedUnitsCte(): string {
	return `
	WITH generated AS (
		SELECT ordinal,
			md5('rezics-scale-seed:v1:' || $1::text || ':' || ordinal::text)::uuid AS unit_id,
			CASE
				WHEN mod(ordinal - 1, 100) < $4::integer THEN 'book'
				WHEN mod(ordinal - 1, 100) < $5::integer THEN 'software'
				ELSE 'media'
			END AS kind,
			$2::uuid AS owner_profile_id,
			$3::timestamptz
				- (mod(ordinal - 1, 90) * interval '1 day')
				- (mod(ordinal, 86400) * interval '1 second') AS created_at
		FROM generate_series($6::integer, $7::integer) AS series(ordinal)
	)`;
}

function seedParameters(options: ScaleSeedSeedOptions, start: number, end: number): QueryValue[] {
	const [bookBoundary, softwareBoundary] = distributionBoundaries(options.distribution);
	return [
		options.runId,
		ScaleSeedOwnerProfileId,
		options.referenceTime.toISOString(),
		bookBoundary,
		softwareBoundary,
		start,
		end,
	];
}

async function insertScaleUnits(
	client: Client,
	options: ScaleSeedSeedOptions,
	start: number,
	end: number,
): Promise<void> {
	const parameters = seedParameters(options, start, end);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.unit (
			id, kind, status, visibility, content_rating, ai_disclosure,
			moderation_status, published_at, created_at, updated_at
		)
		SELECT unit_id, kind,
			'published'::unit_status,
			'public'::resource_visibility,
			'general'::content_rating,
			'unknown'::ai_disclosure,
			'approved'::moderation_status,
			created_at, created_at, created_at
		FROM generated`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.unit_status_event (
			unit_id, from_status, to_status, actor_kind, changed_by_profile_id, created_at
		)
		SELECT unit_id, NULL,
			'published'::unit_status,
			'system'::unit_status_actor_kind,
			NULL, created_at
		FROM generated`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.unit_localization (
			unit_id, language, position, title, summary, created_at, updated_at
		)
		SELECT unit_id, 'en', 'a0',
			'Scale seed [' || $1::text || '] #' || lpad(ordinal::text, 8, '0') || ' ' || initcap(kind),
			'Synthetic published ' || kind || ' Unit for local feed performance testing.',
			created_at, created_at
		FROM generated`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.unit_ownership (
			unit_id, profile_id, assigned_by_profile_id, created_at, updated_at
		)
		SELECT unit_id, $2::uuid, $2::uuid, created_at, created_at
		FROM generated`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.book (
			id, release_status, publication_date, page_count, word_count, format,
			created_at, updated_at
		)
		SELECT unit_id,
			CASE mod(ordinal, 3)
				WHEN 0 THEN 'completed'
				WHEN 1 THEN 'ongoing'
				ELSE 'hiatus'
			END,
			($3::date - (mod(ordinal - 1, 365) * interval '1 day'))::date,
			100 + mod(ordinal, 900),
			10_000 + mod(ordinal, 90_000),
			CASE mod(ordinal, 3) WHEN 0 THEN 'ebook' WHEN 1 THEN 'paperback' ELSE 'hardcover' END,
			created_at, created_at
		FROM generated
		WHERE kind = 'book'`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.software (id, release_date, version_label, created_at, updated_at)
		SELECT unit_id,
			($3::date - (mod(ordinal - 1, 365) * interval '1 day'))::date,
			'0.' || (1 + mod(ordinal, 20))::text || '.' || mod(ordinal, 100)::text,
			created_at, created_at
		FROM generated
		WHERE kind = 'software'`,
		parameters,
	);
	await client.query(
		`${generatedUnitsCte()}
		INSERT INTO public.media (
			id, release_status, kind, release_date, runtime_minutes, episode_count,
			season_count, created_at, updated_at
		)
		SELECT unit_id,
			CASE mod(ordinal, 3)
				WHEN 0 THEN 'completed'
				WHEN 1 THEN 'ongoing'
				ELSE 'hiatus'
			END,
			CASE mod(ordinal, 3) WHEN 0 THEN 'film' WHEN 1 THEN 'series' ELSE 'documentary' END,
			($3::date - (mod(ordinal - 1, 365) * interval '1 day'))::date,
			80 + mod(ordinal, 140),
			CASE WHEN mod(ordinal, 3) = 1 THEN 4 + mod(ordinal, 20) ELSE NULL END,
			CASE WHEN mod(ordinal, 3) = 1 THEN 1 + mod(ordinal, 5) ELSE NULL END,
			created_at, created_at
		FROM generated
		WHERE kind = 'media'`,
		parameters,
	);
	if (options.eventsPerUnit > 0) {
		await client.query(
			`${generatedUnitsCte()}
		INSERT INTO public.recommendation_event (
			profile_id, request_id, surface, type, target_unit_id, position,
			policy_version, occurred_at
		)
		SELECT NULL,
			md5(
				'rezics-scale-seed:v1:' || $1::text || ':request:' || ordinal::text || ':' || event_ordinal::text
			)::uuid,
			'home_feed'::recommendation_surface,
			CASE mod(ordinal + event_ordinal, 4)
				WHEN 0 THEN 'impression'
				WHEN 1 THEN 'open'
				WHEN 2 THEN 'dwell_30s'
				ELSE 'not_interested'
			END::recommendation_event_type,
			unit_id,
			mod(ordinal + event_ordinal, 20),
			$8::text,
			$3::timestamptz - (mod(ordinal + event_ordinal, 168) * interval '1 hour')
		FROM generated
		CROSS JOIN LATERAL generate_series(0, $9::integer - 1) AS events(event_ordinal)`,
			[...parameters, scaleSeedPolicyVersion(options.runId), options.eventsPerUnit],
		);
	}
}

async function analyzeScaleSeedTables(client: Client): Promise<void> {
	for (const table of [
		"unit",
		"unit_localization",
		"unit_status_event",
		"unit_ownership",
		"book",
		"software",
		"media",
		"recommendation_event",
		"recommendation_metric_daily",
	] as const)
		await client.query(`ANALYZE public.${table}`);
}

async function assertSeedCanStart(client: Client, options: ScaleSeedSeedOptions): Promise<void> {
	const owner = await client.query<{ readonly id: string }>(
		"SELECT id FROM public.profile WHERE id = $1::uuid LIMIT 1",
		[ScaleSeedOwnerProfileId],
	);
	if (!owner.rows[0])
		throw new Error(
			`Platform profile ${ScaleSeedOwnerProfileId} is missing; run platform installation before scale-seed`,
		);
	const prefix = scaleSeedTitlePrefix(options.runId);
	const existing = await client.query<{ readonly exists: boolean }>(
		`SELECT EXISTS (
			SELECT 1
			FROM public.unit_localization
			WHERE language = 'en'
				AND left(title, char_length($1::text)) = $1::text
		) AS exists`,
		[prefix],
	);
	if (existing.rows[0]?.exists)
		throw new Error(
			`Scale-seed run ${options.runId} already exists or was partially created; purge it before reusing the run id`,
		);
}

async function runSeed(client: Client, options: ScaleSeedSeedOptions): Promise<void> {
	await assertSeedCanStart(client, options);
	const startedAt = performance.now();
	for (let start = 1; start <= options.units; start += options.batchSize) {
		const end = Math.min(start + options.batchSize - 1, options.units);
		await client.query("BEGIN");
		try {
			await client.query("SET LOCAL lock_timeout = '1s'");
			await client.query("SET LOCAL statement_timeout = '60s'");
			await client.query("SET LOCAL synchronous_commit = 'off'");
			await insertScaleUnits(client, options, start, end);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}
		console.info("Scale seed batch committed", {
			runId: options.runId,
			inserted: end - start + 1,
			completed: end,
			total: options.units,
		});
	}
	await analyzeScaleSeedTables(client);
	console.info("Scale seed completed", {
		runId: options.runId,
		units: options.units,
		events: options.units * options.eventsPerUnit,
		distribution: options.distribution,
		milliseconds: Math.round(performance.now() - startedAt),
		followUp:
			"Run `task services-main:recommendations:refresh` explicitly when you want a new snapshot.",
	});
}

async function runPurge(client: Client, options: ScaleSeedPurgeOptions): Promise<void> {
	const prefix = scaleSeedTitlePrefix(options.runId);
	await client.query("BEGIN");
	try {
		await client.query("SET LOCAL lock_timeout = '1s'");
		await client.query("SET LOCAL statement_timeout = '60s'");
		const statusEvents = await client.query(
			`DELETE FROM public.unit_status_event
			WHERE unit_id IN (
				SELECT unit_id
				FROM public.unit_localization
				WHERE language = 'en'
					AND left(title, char_length($1::text)) = $1::text
			)`,
			[prefix],
		);
		const dailyMetrics = await client.query(
			`DELETE FROM public.recommendation_metric_daily
			WHERE policy_version = $1::text`,
			[scaleSeedPolicyVersion(options.runId)],
		);
		const units = await client.query(
			`DELETE FROM public.unit
			WHERE id IN (
				SELECT unit_id
				FROM public.unit_localization
				WHERE language = 'en'
					AND left(title, char_length($1::text)) = $1::text
			)
			RETURNING id`,
			[prefix],
		);
		await client.query("COMMIT");
		await analyzeScaleSeedTables(client);
		console.info("Scale seed purged", {
			runId: options.runId,
			units: units.rowCount ?? 0,
			statusEvents: statusEvents.rowCount ?? 0,
			dailyMetrics: dailyMetrics.rowCount ?? 0,
		});
	} catch (error) {
		await client.query("ROLLBACK");
		throw error;
	}
}

async function main(): Promise<void> {
	assertLocalDatabase();
	const options = parseScaleSeedOptions(process.argv.slice(2));
	const client = new Client({ connectionString: adminDatabaseUrl });
	try {
		await client.connect();
		if (options.action === "seed") await runSeed(client, options);
		else await runPurge(client, options);
	} finally {
		await client.end();
	}
}

try {
	await main();
} finally {
	await observability.shutdown();
}
