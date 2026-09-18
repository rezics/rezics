import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	primaryKey,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "../shared/base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUuidv7PrimaryKey,
} from "../shared/columns";
import { catalogSubtypeColumns, catalogSubtypeConstraints } from "../catalog/domain-columns";
import { publishingPublication, publishingTextVersion } from "./publishing";
import { musicRelease, musicRecording } from "../music/music";
import { softwareContent, softwareRelease } from "../software/software";
import { programVersion, programEpisode } from "../audiovisual/program";
import { users } from "../identity/auth";

/** Optional mixed-domain distribution identity; never a mandatory parent of a domain release. */
export const distributionPackage = pgTable(
	"distribution_package",
	{
		...catalogSubtypeColumns("package"),
		currentRevision: bigint({ mode: "number" }).default(0).notNull(),
	},
	(t) => [
		...catalogSubtypeConstraints("distribution_package", "distribution", "package", t),
		check(
			"distribution_package_revision_check",
			sql`${t.currentRevision} between 0 and 9007199254740991`,
		),
	],
);

/** Append-only staging stream. Sealing and publishing do not scan or copy its members. */
export const distributionManifest = pgTable(
	"distribution_manifest",
	{
		packageId: uuid()
			.notNull()
			.references(() => distributionPackage.id, { onDelete: "restrict" }),
		id: createUuidv7PrimaryKey(),
		memberCount: bigint({ mode: "number" }).default(0).notNull(),
		sealedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		unique("distribution_manifest_package_key").on(t.packageId, t.id),
		check(
			"distribution_manifest_count_check",
			sql`${t.memberCount} between 0 and 9007199254740991`,
		),
	],
);

/** An occurrence, not a unique package/content pair. No package target means no containment cycles. */
export const distributionMember = pgTable(
	"distribution_member",
	{
		packageId: uuid().notNull(),
		manifestId: uuid().notNull(),
		occurrenceId: uuid().notNull(),
		position: bigint({ mode: "number" }).notNull(),
		originalNumber: text(),
		quantity: bigint({ mode: "number" }),
		publicationId: uuid().references(() => publishingPublication.id, { onDelete: "restrict" }),
		textVersionId: uuid().references(() => publishingTextVersion.id, { onDelete: "restrict" }),
		softwareContentId: uuid().references(() => softwareContent.id, { onDelete: "restrict" }),
		softwareReleaseId: uuid().references(() => softwareRelease.id, { onDelete: "restrict" }),
		musicReleaseId: uuid().references(() => musicRelease.id, { onDelete: "restrict" }),
		recordingId: uuid().references(() => musicRecording.id, { onDelete: "restrict" }),
		programVersionId: uuid().references(() => programVersion.id, { onDelete: "restrict" }),
		episodeId: uuid().references(() => programEpisode.id, { onDelete: "restrict" }),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.manifestId, t.position] }),
		unique("distribution_member_occurrence_key").on(t.packageId, t.manifestId, t.occurrenceId),
		foreignKey({
			name: "distribution_member_manifest_fk",
			columns: [t.packageId, t.manifestId],
			foreignColumns: [distributionManifest.packageId, distributionManifest.id],
		}).onDelete("restrict"),
		check(
			"distribution_member_target_check",
			sql`num_nonnulls(${t.publicationId}, ${t.textVersionId}, ${t.softwareContentId}, ${t.softwareReleaseId}, ${t.musicReleaseId}, ${t.recordingId}, ${t.programVersionId}, ${t.episodeId}) = 1`,
		),
		check("distribution_member_position_check", sql`${t.position} between 0 and 9007199254740990`),
		check(
			"distribution_member_quantity_check",
			sql`${t.quantity} is null or ${t.quantity} between 1 and 9007199254740991`,
		),
		check(
			"distribution_member_number_check",
			sql`${t.originalNumber} is null or octet_length(${t.originalNumber}) between 1 and 1024`,
		),
		...[
			t.publicationId,
			t.textVersionId,
			t.softwareContentId,
			t.softwareReleaseId,
			t.musicReleaseId,
			t.recordingId,
			t.programVersionId,
			t.episodeId,
		].map((column, i) =>
			index(`distribution_member_target_${i}_idx`)
				.on(column, t.packageId, t.manifestId, t.position)
				.where(sql`${column} is not null`),
		),
	],
);

/** Immutable complete package revision. Restoring references an existing sealed manifest. */
export const distributionRevision = pgTable(
	"distribution_revision",
	{
		packageId: uuid()
			.notNull()
			.references(() => distributionPackage.id, { onDelete: "restrict" }),
		revision: bigint({ mode: "number" }).notNull(),
		manifestId: uuid().notNull(),
		label: text(),
		createdAt: createCreatedAtColumn(),
		createdByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
	},
	(t) => [
		primaryKey({ columns: [t.packageId, t.revision] }),
		foreignKey({
			name: "distribution_revision_manifest_fk",
			columns: [t.packageId, t.manifestId],
			foreignColumns: [distributionManifest.packageId, distributionManifest.id],
		}).onDelete("restrict"),
		index("distribution_revision_manifest_idx").on(t.packageId, t.manifestId, t.revision),
		check("distribution_revision_number_check", sql`${t.revision} between 1 and 9007199254740991`),
		check(
			"distribution_revision_label_check",
			sql`${t.label} is null or octet_length(${t.label}) between 1 and 4096`,
		),
	],
);
