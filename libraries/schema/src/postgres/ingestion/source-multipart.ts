import { sql } from "drizzle-orm";
import {
	check,
	foreignKey,
	integer,
	primaryKey,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import { catalogSourceSnapshot } from "./source";
import {
	SOURCE_DOCUMENT_BYTE_LIMIT,
	SOURCE_MULTIPART_BYTE_LIMIT,
	SOURCE_MULTIPART_PART_LIMIT,
} from "./source-limits";

/** A stable manifest seals independently observed raw profiles and one explicitly derived native view. */
export const catalogSourceSnapshotBundle = pgTable(
	"catalog_source_snapshot_bundle",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		profile: text().notNull(),
		derivationContractSha256: text().notNull(),
		partCount: integer().notNull(),
		totalBytes: integer().notNull(),
		consistency: text().$type<"overlaps_validated">().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.snapshotId] }),
		foreignKey({
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		check(
			"catalog_source_snapshot_bundle_values",
			sql`octet_length(${t.profile}) between 1 and 128 and ${t.derivationContractSha256} ~ '^[0-9a-f]{64}$' and ${t.partCount} between 2 and ${sql.raw(String(SOURCE_MULTIPART_PART_LIMIT))} and ${t.totalBytes} between 1 and ${sql.raw(String(SOURCE_MULTIPART_BYTE_LIMIT))} and ${t.consistency}='overlaps_validated'`,
		),
	],
);
export const catalogSourceSnapshotPart = pgTable(
	"catalog_source_snapshot_part",
	{
		sourceRecordId: uuid().notNull(),
		snapshotId: uuid().notNull(),
		key: text().notNull(),
		position: integer().notNull(),
		profile: text().notNull(),
		kind: text().$type<"upstream_response" | "derived_view">().notNull(),
		contentSha256: text().notNull(),
		payloadRef: text().notNull(),
		byteLength: integer().notNull(),
		requestUrl: text(),
		observedAt: timestamp({ withTimezone: true, precision: 3 }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.snapshotId, t.key] }),
		uniqueIndex("catalog_source_snapshot_part_position_key").on(
			t.sourceRecordId,
			t.snapshotId,
			t.position,
		),
		foreignKey({
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [
				catalogSourceSnapshotBundle.sourceRecordId,
				catalogSourceSnapshotBundle.snapshotId,
			],
		}).onDelete("restrict"),
		check(
			"catalog_source_snapshot_part_values",
			sql`${t.key} ~ '^[a-z][a-z0-9_]{0,63}$' and ${t.position} between 0 and ${sql.raw(String(SOURCE_MULTIPART_PART_LIMIT - 1))} and octet_length(${t.profile}) between 1 and 128 and ${t.contentSha256} ~ '^[0-9a-f]{64}$' and octet_length(${t.payloadRef}) between 1 and 2048 and ${t.byteLength} between 1 and ${sql.raw(String(SOURCE_DOCUMENT_BYTE_LIMIT))} and ((${t.kind}='derived_view' and ${t.key}='native_view' and ${t.requestUrl} is null) or (${t.kind}='upstream_response' and ${t.key}<>'native_view' and ${t.requestUrl} is not null and octet_length(${t.requestUrl}) between 1 and 2048))`,
		),
	],
);
