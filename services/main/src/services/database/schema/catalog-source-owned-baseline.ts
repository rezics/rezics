import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	foreignKey,
	primaryKey,
	text,
	uuid,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { pgTable } from "./base";
import { catalogSourceMappingClaim, catalogSourceSnapshot } from "./catalog-source";
import { catalogSourceApplication } from "./catalog-source-application";
import { CatalogFactTables } from "./catalog-facts";
import { CatalogNameTables } from "./catalog-names";
import type { CatalogOwner } from "../../catalog/contracts";
import {
	softwareComponentRevision,
	softwareRecordRevision,
	softwareParticipationContextRevision,
} from "./catalog-software";
import { softwareParticipationRevision } from "./catalog-software-participation";

function baselineColumns(owner: CatalogOwner) {
	return {
		sourceRecordId: uuid().notNull(),
		mappingOwner: text().$type<CatalogOwner>().default(owner).notNull(),
		mappingKey: uuid().notNull(),
		ownerId: uuid().notNull(),
		sourceSnapshotId: uuid().notNull(),
		sourcePath: text().notNull(),
		sourceRevision: bigint({ mode: "number" }).notNull(),
		currentRevision: bigint({ mode: "number" }).notNull(),
		absent: boolean().notNull().default(false),
		lastProposalId: uuid().notNull(),
		lastAction: text().$type<"apply" | "withdraw">().notNull(),
	};
}
function baselineConstraints(
	prefix: string,
	t: {
		sourceRecordId: AnyPgColumn;
		mappingKey: AnyPgColumn;
		mappingOwner: AnyPgColumn;
		sourceSnapshotId: AnyPgColumn;
		sourcePath: AnyPgColumn;
		lastProposalId: AnyPgColumn;
		lastAction: AnyPgColumn;
		sourceRevision: AnyPgColumn;
		currentRevision: AnyPgColumn;
	},
	owner: CatalogOwner,
) {
	return [
		check(`${prefix}_owner`, sql`${t.mappingOwner} = ${owner}`),
		foreignKey({
			name: `${prefix}_mapping_fk`,
			columns: [t.sourceRecordId, t.mappingKey, t.mappingOwner],
			foreignColumns: [
				catalogSourceMappingClaim.sourceRecordId,
				catalogSourceMappingClaim.mappingKey,
				catalogSourceMappingClaim.owner,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: `${prefix}_snapshot_fk`,
			columns: [t.sourceRecordId, t.sourceSnapshotId],
			foreignColumns: [catalogSourceSnapshot.sourceRecordId, catalogSourceSnapshot.id],
		}).onDelete("restrict"),
		foreignKey({
			name: `${prefix}_application_fk`,
			columns: [t.sourceRecordId, t.lastProposalId, t.lastAction],
			foreignColumns: [
				catalogSourceApplication.sourceRecordId,
				catalogSourceApplication.proposalId,
				catalogSourceApplication.action,
			],
		}).onDelete("restrict"),
		check(
			`${prefix}_values`,
			sql`octet_length(${t.sourcePath}) between 1 and 512 and ${t.sourceRevision} between 1 and 9007199254740991 and ${t.currentRevision} between 1 and 9007199254740991`,
		),
	];
}
function ownedBaseline(owner: CatalogOwner) {
	const semantic = CatalogFactTables[owner].semanticRevision;
	const { nameRevision: name, authorityRevision: authority } = CatalogNameTables[owner];
	return pgTable(
		`${owner}_source_owned_baseline`,
		{
			...baselineColumns(owner),
			kind: text()
				.$type<"catalog-semantic" | "catalog-name" | "catalog-name-authority">()
				.notNull(),
			componentKey: uuid().notNull(),
			semanticId: uuid(),
			nameId: uuid(),
			authorityId: uuid(),
		},
		(t) => [
			primaryKey({ columns: [t.sourceRecordId, t.mappingKey, t.ownerId, t.kind, t.componentKey] }),
			...baselineConstraints(`${owner}_source_owned_base`, t, owner),
			foreignKey({
				name: `${owner}_owned_base_semantic_source_fk`,
				columns: [t.ownerId, t.semanticId, t.sourceRevision],
				foreignColumns: [semantic.ownerId, semantic.semanticId, semantic.version],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_owned_base_semantic_current_fk`,
				columns: [t.ownerId, t.semanticId, t.currentRevision],
				foreignColumns: [semantic.ownerId, semantic.semanticId, semantic.version],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_owned_base_name_source_fk`,
				columns: [t.ownerId, t.nameId, t.sourceRevision],
				foreignColumns: [name.ownerId, name.id, name.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_owned_base_name_current_fk`,
				columns: [t.ownerId, t.nameId, t.currentRevision],
				foreignColumns: [name.ownerId, name.id, name.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_owned_base_authority_source_fk`,
				columns: [t.ownerId, t.authorityId, t.sourceRevision],
				foreignColumns: [authority.ownerId, authority.id, authority.revision],
			}).onDelete("restrict"),
			foreignKey({
				name: `${owner}_owned_base_authority_current_fk`,
				columns: [t.ownerId, t.authorityId, t.currentRevision],
				foreignColumns: [authority.ownerId, authority.id, authority.revision],
			}).onDelete("restrict"),
			check(
				`${owner}_source_owned_base_kind`,
				sql`num_nonnulls(${t.semanticId},${t.nameId},${t.authorityId}) = 1 and ((${t.kind} = 'catalog-semantic' and ${t.componentKey} = ${t.semanticId}) or (${t.kind} = 'catalog-name' and ${t.componentKey} = ${t.nameId}) or (${t.kind} = 'catalog-name-authority' and ${t.componentKey} = ${t.authorityId}))`,
			),
		],
	);
}

/** Direct source/native head correspondence; compensation never traverses application history chains. */
export const CatalogSourceOwnedBaselines = {
	publishing: ownedBaseline("publishing"),
	music: ownedBaseline("music"),
	program: ownedBaseline("program"),
	software: ownedBaseline("software"),
	entity: ownedBaseline("entity"),
	grouping: ownedBaseline("grouping"),
	reference: ownedBaseline("reference"),
	distribution: ownedBaseline("distribution"),
};
export const publishingSourceOwnedBaseline = CatalogSourceOwnedBaselines.publishing;
export const musicSourceOwnedBaseline = CatalogSourceOwnedBaselines.music;
export const programSourceOwnedBaseline = CatalogSourceOwnedBaselines.program;
export const softwareSourceOwnedBaseline = CatalogSourceOwnedBaselines.software;
export const entitySourceOwnedBaseline = CatalogSourceOwnedBaselines.entity;
export const groupingSourceOwnedBaseline = CatalogSourceOwnedBaselines.grouping;
export const referenceSourceOwnedBaseline = CatalogSourceOwnedBaselines.reference;
export const distributionSourceOwnedBaseline = CatalogSourceOwnedBaselines.distribution;

function softwareChildBaseline(
	kind: "context" | "participation",
	target: readonly [AnyPgColumn, AnyPgColumn, AnyPgColumn],
) {
	return pgTable(
		`software_source_${kind}_baseline`,
		{ ...baselineColumns("software"), componentKey: uuid().notNull() },
		(t) => [
			primaryKey({ columns: [t.sourceRecordId, t.mappingKey, t.ownerId, t.componentKey] }),
			...baselineConstraints(`software_source_${kind}_base`, t, "software"),
			foreignKey({
				name: `software_${kind}_base_source_fk`,
				columns: [t.ownerId, t.componentKey, t.sourceRevision],
				foreignColumns: [...target],
			}).onDelete("restrict"),
			foreignKey({
				name: `software_${kind}_base_current_fk`,
				columns: [t.ownerId, t.componentKey, t.currentRevision],
				foreignColumns: [...target],
			}).onDelete("restrict"),
		],
	);
}
export const softwareSourceContextBaseline = softwareChildBaseline("context", [
	softwareParticipationContextRevision.contentId,
	softwareParticipationContextRevision.contextId,
	softwareParticipationContextRevision.revision,
]);
export const softwareSourceParticipationBaseline = softwareChildBaseline("participation", [
	softwareParticipationRevision.contentId,
	softwareParticipationRevision.participationId,
	softwareParticipationRevision.revision,
]);

export const softwareSourceComponentBaseline = pgTable(
	"software_source_component_baseline",
	{
		...baselineColumns("software"),
		component: text().$type<typeof softwareComponentRevision.$inferSelect.kind>().notNull(),
		componentKey: text().notNull(),
	},
	(t) => [
		primaryKey({
			columns: [t.sourceRecordId, t.mappingKey, t.ownerId, t.component, t.componentKey],
		}),
		...baselineConstraints("software_source_component_base", t, "software"),
		foreignKey({
			name: "software_component_base_source_fk",
			columns: [t.ownerId, t.component, t.componentKey, t.sourceRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_component_base_current_fk",
			columns: [t.ownerId, t.component, t.componentKey, t.currentRevision],
			foreignColumns: [
				softwareComponentRevision.releaseId,
				softwareComponentRevision.kind,
				softwareComponentRevision.componentId,
				softwareComponentRevision.revision,
			],
		}).onDelete("restrict"),
	],
);
export const softwareSourceRecordBaseline = pgTable(
	"software_source_record_baseline",
	{ ...baselineColumns("software") },
	(t) => [
		primaryKey({ columns: [t.sourceRecordId, t.mappingKey, t.ownerId] }),
		...baselineConstraints("software_source_record_base", t, "software"),
		foreignKey({
			name: "software_record_base_source_fk",
			columns: [t.ownerId, t.sourceRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
		foreignKey({
			name: "software_record_base_current_fk",
			columns: [t.ownerId, t.currentRevision],
			foreignColumns: [softwareRecordRevision.ownerId, softwareRecordRevision.revision],
		}).onDelete("restrict"),
	],
);
