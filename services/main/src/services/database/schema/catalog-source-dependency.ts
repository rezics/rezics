import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	index,
	integer,
	primaryKey,
	text,
	uuid,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn, createTimestampMsColumn } from "./columns";
import { users } from "./auth";
import { CatalogIdentityTables } from "./catalog-identity";
import {
	catalogSourceAdoptionProposal,
	catalogSourceBindingRevision,
	catalogSourceSnapshot,
} from "./catalog-source";

/** Exact proposal dependencies authorize only bounded reads, never writes to another owner. */
export const catalogSourceProposalDependency = pgTable(
	"catalog_source_proposal_dependency",
	{
		sourceRecordId: uuid().notNull(),
		proposalId: uuid().notNull(),
		position: integer().notNull(),
		snapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
		dependencySourceRecordId: uuid().notNull(),
		dependencyMappingKey: uuid().notNull(),
		dependencyBindingRevision: bigint({ mode: "number" }).notNull(),
		publishingId: uuid().references(() => CatalogIdentityTables.publishing.id, {
			onDelete: "restrict",
		}),
		musicId: uuid().references(() => CatalogIdentityTables.music.id, { onDelete: "restrict" }),
		programId: uuid().references(() => CatalogIdentityTables.program.id, { onDelete: "restrict" }),
		softwareId: uuid().references(() => CatalogIdentityTables.software.id, {
			onDelete: "restrict",
		}),
		entityId: uuid().references(() => CatalogIdentityTables.entity.id, { onDelete: "restrict" }),
		groupingId: uuid().references(() => CatalogIdentityTables.grouping.id, {
			onDelete: "restrict",
		}),
		referenceId: uuid().references(() => CatalogIdentityTables.reference.id, {
			onDelete: "restrict",
		}),
		distributionId: uuid().references(() => CatalogIdentityTables.distribution.id, {
			onDelete: "restrict",
		}),
		preparedByAuthUserId: uuid().references(() => users.id, { onDelete: "set null" }),
		revokedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.position] }),
		foreignKey({
			name: "catalog_source_dependency_proposal_fk",
			columns: [t.sourceRecordId, t.proposalId],
			foreignColumns: [
				catalogSourceAdoptionProposal.sourceRecordId,
				catalogSourceAdoptionProposal.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_dependency_snapshot_fk",
			columns: [t.sourceRecordId, t.snapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_dependency_binding_fk",
			columns: [t.dependencySourceRecordId, t.dependencyMappingKey, t.dependencyBindingRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
		check("catalog_source_dependency_position_check", sql`${t.position} between 0 and 8191`),
		check(
			"catalog_source_dependency_path_check",
			sql`left(${t.sourcePath},1)='/' and octet_length(${t.sourcePath}) between 1 and 512`,
		),
		check(
			"catalog_source_dependency_target_check",
			sql`num_nonnulls(${t.publishingId},${t.musicId},${t.programId},${t.softwareId},${t.entityId},${t.groupingId},${t.referenceId},${t.distributionId})=1`,
		),
		index("catalog_source_dependency_binding_idx").on(
			t.dependencySourceRecordId,
			t.dependencyMappingKey,
			t.dependencyBindingRevision,
			t.sourceRecordId,
			t.proposalId,
		),
		index("catalog_source_dependency_preparer_idx").on(
			t.preparedByAuthUserId,
			t.sourceRecordId,
			t.proposalId,
		),
	],
);
