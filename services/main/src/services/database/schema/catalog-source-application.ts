import { sql } from "drizzle-orm";
import {
	bigint,
	check,
	foreignKey,
	integer,
	primaryKey,
	text,
	uuid,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { createCreatedAtColumn } from "./columns";
import {
	catalogSourceAdoptionProposal,
	catalogSourceSnapshot,
	catalogSourceBindingRevision,
} from "./catalog-source";
import { musicComponentRevision } from "./catalog-music";
import { CatalogFactTables } from "./catalog-facts";
import { CatalogNameTables } from "./catalog-names";
import { type CatalogOwner } from "../../catalog/contracts";
import { CatalogProfileHistoryTables } from "./catalog-profile-source";
import { softwareParticipationRevision } from "./catalog-software-participation";
import {
	softwareParticipationContextRevision,
	softwareComponentRevision,
	softwareRecordRevision,
} from "./catalog-software";

/** Immutable native application evidence, separate from both source bytes and current native authority. */
export const catalogSourceApplication = pgTable(
	"catalog_source_application",
	{
		sourceRecordId: uuid().notNull(),
		proposalId: uuid().notNull(),
		mappingKey: uuid().notNull(),
		action: text().$type<"apply" | "withdraw">().notNull(),
		previousSnapshotId: uuid(),
		previousObservedSnapshotId: uuid(),
		previousCorrespondenceRevision: bigint({ mode: "number" }),
		previousEvidenceSourceRecordId: uuid(),
		previousEvidenceSnapshotId: uuid(),
		previousEvidencePath: text(),
		beforeRevision: bigint({ mode: "number" }).notNull(),
		afterRevision: bigint({ mode: "number" }).notNull(),
		changeCount: integer().notNull(),
		createdAt: createCreatedAtColumn(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId],
			foreignColumns: [
				catalogSourceAdoptionProposal.sourceRecordId,
				catalogSourceAdoptionProposal.id,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.sourceRecordId, t.previousSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_application_previous_observation_fk",
			columns: [t.sourceRecordId, t.previousObservedSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_application_previous_correspondence_fk",
			columns: [t.sourceRecordId, t.mappingKey, t.previousCorrespondenceRevision],
			foreignColumns: [
				catalogSourceBindingRevision.sourceRecordId,
				catalogSourceBindingRevision.mappingKey,
				catalogSourceBindingRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "catalog_source_application_previous_evidence_fk",
			columns: [t.previousEvidenceSourceRecordId, t.previousEvidenceSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		check(
			"catalog_source_application_previous_evidence_check",
			sql`num_nonnulls(${t.previousEvidenceSourceRecordId},${t.previousEvidenceSnapshotId},${t.previousEvidencePath}) = 0 or (${t.previousSnapshotId} is null and num_nonnulls(${t.previousEvidenceSourceRecordId},${t.previousEvidenceSnapshotId},${t.previousEvidencePath}) = 3 and octet_length(${t.previousEvidencePath}) between 1 and 512)`,
		),
		check(
			"catalog_source_application_values",
			sql`${t.action} in ('apply','withdraw') and ${t.beforeRevision} >= 1 and ${t.afterRevision} > ${t.beforeRevision} and ${t.afterRevision} <= 9007199254740991 and ${t.changeCount} between 0 and 128`,
		),
	],
);

function applicationColumns() {
	return {
		sourceRecordId: uuid().notNull(),
		proposalId: uuid().notNull(),
		action: text().$type<"apply" | "withdraw">().notNull(),
		position: integer().notNull(),
		ownerId: uuid().notNull(),
	};
}

function profileApplicationTable(owner: keyof typeof CatalogProfileHistoryTables) {
	const history = CatalogProfileHistoryTables[owner];
	return pgTable(
		`${owner}_source_profile_application_change`,
		{
			...applicationColumns(),
			beforeRevision: bigint({ mode: "number" }),
			afterRevision: bigint({ mode: "number" }).notNull(),
		},
		(t) => [
			primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
			foreignKey({
				name: `${owner}_profile_app_journal_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_profile_app_before_fk`,
				columns: [t.ownerId, t.beforeRevision],
				foreignColumns: [history.ownerId, history.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_profile_app_after_fk`,
				columns: [t.ownerId, t.afterRevision],
				foreignColumns: [history.ownerId, history.revision],
			}).onDelete("restrict"),
			check(
				`${owner}_profile_app_values`,
				sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
			),
		],
	);
}
export const CatalogSourceProfileApplicationTables = {
	entity: profileApplicationTable("entity"),
	reference: profileApplicationTable("reference"),
};
export const entitySourceProfileApplicationChange = CatalogSourceProfileApplicationTables.entity;
export const referenceSourceProfileApplicationChange =
	CatalogSourceProfileApplicationTables.reference;

/** Exact music history foreign keys remain valid after component removal or source rebinding. */
export const musicSourceApplicationChange = pgTable(
	"music_source_application_change",
	{
		...applicationColumns(),
		component: text().notNull(),
		componentKey: text().notNull(),
		beforeRevisionId: uuid(),
		afterRevisionId: uuid().notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.beforeRevisionId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.afterRevisionId],
			foreignColumns: [musicComponentRevision.ownerId, musicComponentRevision.id],
		}).onDelete("restrict"),
		check(
			"music_source_application_values",
			sql`${t.position} between 0 and 127 and octet_length(${t.component}) between 1 and 96 and octet_length(${t.componentKey}) between 1 and 1536 and (${t.beforeRevisionId} is null or ${t.beforeRevisionId} <> ${t.afterRevisionId})`,
		),
	],
);

export const softwareSourceComponentApplicationChange = pgTable(
	"software_source_component_application_change",
	{
		...applicationColumns(),
		component: text().$type<typeof softwareComponentRevision.$inferSelect.kind>().notNull(),
		componentKey: text().notNull(),
		beforeRevision: bigint({ mode: "number" }),
		afterRevision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.component, t.componentKey, t.beforeRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.component, t.componentKey, t.afterRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		check(
			"software_source_component_application_values",
			sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
		),
	],
);

export const softwareSourceRecordApplicationChange = pgTable(
	"software_source_record_application_change",
	{
		...applicationColumns(),
		beforeRevision: bigint({ mode: "number" }),
		afterRevision: bigint({ mode: "number" }).notNull(),
	},
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.proposalId, t.action, t.position] }),
		foreignKey({
			columns: [t.sourceRecordId, t.proposalId, t.action],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.beforeRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			columns: [t.ownerId, t.afterRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		check(
			"software_source_record_application_values",
			sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
		),
	],
);

function exactRevisionApplicationTable(
	name: string,
	prefix: string,
	target: readonly [AnyPgColumn, AnyPgColumn, AnyPgColumn],
) {
	return pgTable(
		name,
		{
			...applicationColumns(),
			componentKey: uuid().notNull(),
			beforeRevision: bigint({ mode: "number" }),
			afterRevision: bigint({ mode: "number" }).notNull(),
		},
		(t) => [
			primaryKey({
				name: `${prefix}_pk`,
				columns: [t.sourceRecordId, t.proposalId, t.action, t.position],
			}),
			foreignKey({
				name: `${prefix}_app_fk`,
				columns: [t.sourceRecordId, t.proposalId, t.action],
				foreignColumns: [
					catalogSourceApplication.sourceRecordId,
					catalogSourceApplication.proposalId,
					catalogSourceApplication.action,
				],
			}).onDelete("restrict"),
			foreignKey({
				name: `${prefix}_before_fk`,
				columns: [t.ownerId, t.componentKey, t.beforeRevision],
				foreignColumns: [...target],
			}).onDelete("restrict"),
			foreignKey({
				name: `${prefix}_after_fk`,
				columns: [t.ownerId, t.componentKey, t.afterRevision],
				foreignColumns: [...target],
			}).onDelete("restrict"),
			check(
				`${prefix}_values`,
				sql`${t.position} between 0 and 127 and (${t.beforeRevision} is null or ${t.beforeRevision} < ${t.afterRevision})`,
			),
		],
	);
}
function ownerApplicationTables(owner: CatalogOwner) {
	const semantic = CatalogFactTables[owner].semanticRevision;
	const { nameRevision: name, authorityRevision: authority } = CatalogNameTables[owner];
	return {
		semantic: exactRevisionApplicationTable(
			`${owner}_source_semantic_application_change`,
			`${owner}_semantic_app`,
			[semantic.ownerId, semantic.semanticId, semantic.version],
		),
		name: exactRevisionApplicationTable(
			`${owner}_source_name_application_change`,
			`${owner}_name_app`,
			[name.ownerId, name.id, name.revision],
		),
		authority: exactRevisionApplicationTable(
			`${owner}_source_authority_application_change`,
			`${owner}_authority_app`,
			[authority.ownerId, authority.id, authority.revision],
		),
	};
}

/** Every owner has concrete native history FKs; this registry is not an unchecked polymorphic reference. */
export const CatalogSourceOwnedApplicationTables = {
	publishing: ownerApplicationTables("publishing"),
	music: ownerApplicationTables("music"),
	program: ownerApplicationTables("program"),
	software: ownerApplicationTables("software"),
	entity: ownerApplicationTables("entity"),
	grouping: ownerApplicationTables("grouping"),
	reference: ownerApplicationTables("reference"),
	distribution: ownerApplicationTables("distribution"),
};
export const publishingSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.publishing.semantic;
export const publishingSourceNameApplicationChange =
	CatalogSourceOwnedApplicationTables.publishing.name;
export const publishingSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.publishing.authority;
export const musicSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.music.semantic;
export const musicSourceNameApplicationChange = CatalogSourceOwnedApplicationTables.music.name;
export const musicSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.music.authority;
export const programSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.program.semantic;
export const programSourceNameApplicationChange = CatalogSourceOwnedApplicationTables.program.name;
export const programSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.program.authority;
export const softwareSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.software.semantic;
export const softwareSourceNameApplicationChange =
	CatalogSourceOwnedApplicationTables.software.name;
export const softwareSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.software.authority;
export const entitySourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.entity.semantic;
export const entitySourceNameApplicationChange = CatalogSourceOwnedApplicationTables.entity.name;
export const entitySourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.entity.authority;
export const groupingSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.grouping.semantic;
export const groupingSourceNameApplicationChange =
	CatalogSourceOwnedApplicationTables.grouping.name;
export const groupingSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.grouping.authority;
export const referenceSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.reference.semantic;
export const referenceSourceNameApplicationChange =
	CatalogSourceOwnedApplicationTables.reference.name;
export const referenceSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.reference.authority;
export const distributionSourceSemanticApplicationChange =
	CatalogSourceOwnedApplicationTables.distribution.semantic;
export const distributionSourceNameApplicationChange =
	CatalogSourceOwnedApplicationTables.distribution.name;
export const distributionSourceAuthorityApplicationChange =
	CatalogSourceOwnedApplicationTables.distribution.authority;

export const softwareSourceContextApplicationChange = exactRevisionApplicationTable(
	"software_source_context_application_change",
	"software_context_app",
	[
		softwareParticipationContextRevision.contentId,
		softwareParticipationContextRevision.contextId,
		softwareParticipationContextRevision.revision,
	],
);
export const softwareSourceParticipationApplicationChange = exactRevisionApplicationTable(
	"software_source_participation_application_change",
	"software_participation_app",
	[
		softwareParticipationRevision.contentId,
		softwareParticipationRevision.participationId,
		softwareParticipationRevision.revision,
	],
);
