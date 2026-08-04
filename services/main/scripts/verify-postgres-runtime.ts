import { sql } from "drizzle-orm";

import { adminDatabase } from "./admin-database";

const RequiredSlotWalBytes = 32n * 1024n * 1024n * 1024n;

interface RuntimeSettingRow extends Record<string, unknown> {
	readonly maxSlotWalKeepBytes: string;
	readonly sharedPreloadLibraries: string;
}

interface ReplicationSlotRow extends Record<string, unknown> {
	readonly slotName: string;
	readonly walStatus: string | null;
	readonly safeWalSize: string | null;
}

try {
	const settings = await adminDatabase.execute<RuntimeSettingRow>(sql`
		select
			pg_size_bytes(max_slot.setting || coalesce(max_slot.unit, ''))::text as "maxSlotWalKeepBytes",
			preload.setting as "sharedPreloadLibraries"
		from pg_settings max_slot
		cross join pg_settings preload
		where max_slot.name = 'max_slot_wal_keep_size'
			and preload.name = 'shared_preload_libraries'
	`);
	const setting = settings.rows[0];
	if (!setting) throw new Error("PostgreSQL runtime settings are unavailable");
	const configuredBytes = BigInt(setting.maxSlotWalKeepBytes);
	if (configuredBytes < RequiredSlotWalBytes)
		throw new Error(
			`max_slot_wal_keep_size must be at least 32GB; server reports ${configuredBytes} bytes`,
		);
	if (
		!setting.sharedPreloadLibraries
			.split(",")
			.map((value) => value.trim())
			.includes("pg_stat_statements")
	)
		throw new Error("pg_stat_statements is not present in shared_preload_libraries");

	const extension = await adminDatabase.execute<{ installed: boolean }>(sql`
		select exists(
			select 1 from pg_extension where extname = 'pg_stat_statements'
		) as installed
	`);
	if (!extension.rows[0]?.installed)
		throw new Error("pg_stat_statements extension is not installed");

	const slots = await adminDatabase.execute<ReplicationSlotRow>(sql`
		select
			slot_name as "slotName",
			wal_status as "walStatus",
			safe_wal_size::text as "safeWalSize"
		from pg_replication_slots
		where slot_type = 'logical'
		order by slot_name
	`);
	const unsafe = slots.rows.filter(
		(slot) => slot.walStatus === "lost" || slot.walStatus === "unreserved",
	);
	if (unsafe.length)
		throw new Error(
			`Logical replication slots require repair: ${unsafe.map(({ slotName, walStatus }) => `${slotName}=${walStatus}`).join(", ")}`,
		);

	console.info(
		`PostgreSQL runtime verified: max_slot_wal_keep_size=${configuredBytes} bytes, logical_slots=${slots.rows.length}.`,
	);
	for (const slot of slots.rows)
		console.info(
			`Logical slot ${slot.slotName}: wal_status=${slot.walStatus ?? "unknown"}, safe_wal_size=${slot.safeWalSize ?? "unbounded"}.`,
		);
} finally {
	await adminDatabase.$client.end();
}
