import { sql } from "drizzle-orm";
import { boolean, check, index, pgEnum, primaryKey, text, unique, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { profile, unit } from "./core";
import {
	AssociationKindValues,
	AssociationProposalDirectionValues,
	AssociationProposalResolutionValues,
	EntityAssociationPolicyModeValues,
	toEnumValues,
} from "./contract-values";

export const associationKind = pgEnum("association_kind", toEnumValues(AssociationKindValues));
export const entityAssociationPolicyMode = pgEnum(
	"entity_association_policy_mode",
	toEnumValues(EntityAssociationPolicyModeValues),
);
export const associationProposalDirection = pgEnum(
	"association_proposal_direction",
	toEnumValues(AssociationProposalDirectionValues),
);
export const associationProposalResolution = pgEnum(
	"association_proposal_resolution",
	toEnumValues(AssociationProposalResolutionValues),
);

export const entity = pgTable(
	"entity",
	{
		id: uuid()
			.primaryKey()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: text().notNull(),
		verified: boolean().default(false).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("entity_kind_idx").on(table.kind),
		check("entity_kind_not_blank", sql`btrim(${table.kind}) <> ''`),
	],
);

/**
 * Target-side consent for structured incoming relationships. This does not govern
 * free-text mentions or editing the Entity's own fields.
 */
export const entityAssociationPolicy = pgTable(
	"entity_association_policy",
	{
		entityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "cascade" }),
		kind: associationKind().notNull(),
		mode: entityAssociationPolicyMode().default("open").notNull(),
		updatedByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.entityId, table.kind] }),
		index("entity_association_policy_updated_by_idx").on(table.updatedByProfileId),
	],
);

/** Two-sided consent workflow for a relationship stored on a source Unit. */
export const unitAssociationProposal = pgTable(
	"unit_association_proposal",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		targetUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		kind: associationKind().notNull(),
		role: text().notNull(),
		direction: associationProposalDirection().notNull(),
		createdByProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn().notNull(),
		resolution: associationProposalResolution(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_association_proposal_source_unresolved_idx")
			.on(table.sourceUnitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_association_proposal_target_unresolved_idx")
			.on(table.targetUnitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_association_proposal_created_by_idx").on(table.createdByProfileId),
		index("unit_association_proposal_resolved_by_idx").on(table.resolvedByProfileId),
		check("unit_association_proposal_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check(
			"unit_association_proposal_not_self_check",
			sql`${table.sourceUnitId} <> ${table.targetUnitId}`,
		),
		check(
			"unit_association_proposal_expiry_check",
			sql`${table.expiresAt} > ${table.createdAt}`,
		),
		check(
			"unit_association_proposal_resolution_shape_check",
			sql`(
				${table.resolution} is null and ${table.resolvedAt} is null and ${table.resolvedByProfileId} is null
			) or (
				${table.resolution} is not null and ${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null
			)`,
		),
	],
);

/** Author, translator, publisher, and other contribution relationships. */
export const creditAttribution = pgTable(
	"credit_attribution",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		creditedUnitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		role: text().notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("credit_attribution_source_credited_role_key").on(
			table.sourceUnitId,
			table.creditedUnitId,
			table.role,
		),
		index("credit_attribution_credited_unit_role_idx").on(table.creditedUnitId, table.role),
		index("credit_attribution_source_position_idx").on(
			table.sourceUnitId,
			table.position,
			table.id,
		),
		check("credit_attribution_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check(
			"credit_attribution_not_self_check",
			sql`${table.sourceUnitId} <> ${table.creditedUnitId}`,
		),
	],
);

/**
 * A structured “is about” relationship. It does not assert contribution,
 * authorship, endorsement, or identity ownership.
 */
export const subjectAssociation = pgTable(
	"subject_association",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "cascade" }),
		entityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		role: text().notNull(),
		position: fractionalIndexPosition()
			.default(sql`'a0'::text`)
			.notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("subject_association_unit_entity_role_key").on(
			table.unitId,
			table.entityId,
			table.role,
		),
		index("subject_association_entity_role_idx").on(table.entityId, table.role),
		index("subject_association_unit_position_idx").on(table.unitId, table.position, table.id),
		check("subject_association_role_not_blank", sql`btrim(${table.role}) <> ''`),
		check("subject_association_not_self_check", sql`${table.unitId} <> ${table.entityId}`),
	],
);
