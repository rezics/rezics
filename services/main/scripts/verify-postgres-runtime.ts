import { sql } from "drizzle-orm";

import { adminDatabase } from "./admin-database";

const RequiredPreloads = [
	"pg_stat_statements",
	"pgroonga_wal_resource_manager",
	"pgroonga_crash_safer",
] as const;

interface RuntimeSettingRow extends Record<string, unknown> {
	readonly sharedPreloadLibraries: string;
	readonly walResourceManagerEnabled: string;
	readonly crashSafeEnabled: string;
	readonly trackIoTiming: string;
	readonly trackWalIoTiming: string;
	readonly walLevel: string;
	readonly maxReplicationSlots: string;
	readonly maxWorkerProcesses: string;
	readonly maxWalSize: string;
	readonly minWalSize: string;
	readonly legacyWalEnabled: string;
}

try {
	const settings = await adminDatabase.execute<RuntimeSettingRow>(sql`
		select
			preload.setting as "sharedPreloadLibraries",
			wal_manager.setting as "walResourceManagerEnabled",
			crash_safe.setting as "crashSafeEnabled",
			io_timing.setting as "trackIoTiming",
			wal_io_timing.setting as "trackWalIoTiming",
			wal_level.setting as "walLevel",
			replication_slots.setting as "maxReplicationSlots",
			worker_processes.setting as "maxWorkerProcesses",
			max_wal_size.setting as "maxWalSize",
			min_wal_size.setting as "minWalSize",
			coalesce(current_setting('pgroonga.enable_wal', true), 'off') as "legacyWalEnabled"
		from pg_settings preload
		cross join pg_settings wal_manager
		cross join pg_settings crash_safe
		cross join pg_settings io_timing
		cross join pg_settings wal_io_timing
		cross join pg_settings wal_level
		cross join pg_settings replication_slots
		cross join pg_settings worker_processes
		cross join pg_settings max_wal_size
		cross join pg_settings min_wal_size
		where preload.name = 'shared_preload_libraries'
			and wal_manager.name = 'pgroonga.enable_wal_resource_manager'
			and crash_safe.name = 'pgroonga.enable_crash_safe'
			and io_timing.name = 'track_io_timing'
			and wal_io_timing.name = 'track_wal_io_timing'
			and wal_level.name = 'wal_level'
			and replication_slots.name = 'max_replication_slots'
			and worker_processes.name = 'max_worker_processes'
			and max_wal_size.name = 'max_wal_size'
			and min_wal_size.name = 'min_wal_size'
	`);
	const setting = settings.rows[0];
	if (!setting) throw new Error("Required PostgreSQL/PGroonga runtime settings are unavailable");
	const preloads = new Set(setting.sharedPreloadLibraries.split(",").map((value) => value.trim()));
	for (const preload of RequiredPreloads)
		if (!preloads.has(preload))
			throw new Error(`${preload} is not present in shared_preload_libraries`);
	if (setting.walResourceManagerEnabled !== "on" || setting.crashSafeEnabled !== "on")
		throw new Error("PGroonga WAL resource manager and crash-safe mode must both be enabled");
	if (setting.legacyWalEnabled === "on")
		throw new Error("Legacy PGroonga WAL must be disabled with WAL Resource Manager");
	if (Number(setting.maxWorkerProcesses) < 12)
		throw new Error("max_worker_processes must reserve the 12-process production budget");
	if (setting.trackIoTiming !== "on" || setting.trackWalIoTiming !== "on")
		throw new Error("PostgreSQL relation and WAL I/O timing must both be enabled");
	if (setting.walLevel !== "replica" || setting.maxReplicationSlots !== "0")
		throw new Error("PostgreSQL must retain replica WAL without logical replication slots");
	if (setting.maxWalSize !== "8192" || setting.minWalSize !== "2048")
		throw new Error("PostgreSQL WAL capacity must be max 8GB and min 2GB");

	const extensions = await adminDatabase.execute<{ name: string; version: string }>(sql`
		select extname as name, extversion as version
		from pg_extension
		where extname in ('pg_stat_statements', 'pgroonga', 'approx_count', 'amcheck', 'pgstattuple')
	`);
	const installed = new Map(extensions.rows.map((row) => [row.name, row.version]));
	if (installed.get("pgroonga") !== "4.0.8")
		throw new Error(`Expected PGroonga 4.0.8; found ${installed.get("pgroonga") ?? "missing"}`);
	if (installed.get("approx_count") !== "1.0")
		throw new Error(
			`Expected approx_count 1.0; found ${installed.get("approx_count") ?? "missing"}`,
		);
	for (const extension of ["pg_stat_statements", "amcheck", "pgstattuple"])
		if (!installed.has(extension)) throw new Error(`Required extension is missing: ${extension}`);

	const logicalSlots = await adminDatabase.execute<{ count: number }>(sql`
		select count(*)::integer as count from pg_replication_slots where slot_type = 'logical'
	`);
	if (logicalSlots.rows[0]?.count !== 0)
		throw new Error("No v1 workload owns a logical replication slot");

	console.info(
		"PostgreSQL runtime verified: PGroonga 4.0.8 crash safety, approx_count 1.0, statistics, and no logical CDC slots.",
	);
} finally {
	await adminDatabase.$client.end();
}
