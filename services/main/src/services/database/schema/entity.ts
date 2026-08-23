import { inArray, sql } from "drizzle-orm";
import {
	boolean,
	check,
	index,
	integer,
	pgEnum,
	primaryKey,
	smallint,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createJsonObjectColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "./columns";
import { profile } from "./profile";
import { unit } from "./unit";
import { post } from "./post";
import {
	AssociationKindValues,
	AssociationProposalDirectionValues,
	AssociationProposalResolutionValues,
	type AssociationRole,
	CreditAttributionRoleValues,
	type CreditAttributionRole,
	SubjectAssociationRoleValues,
	type SubjectAssociationRole,
	toEnumValues,
} from "./contract-values";

export const associationKind = pgEnum("association_kind", toEnumValues(AssociationKindValues));
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
		/**
		 * Optional evidence context for subject proposals. Credit proposals do
		 * not use a context Post; any stored context must be a wiki Post.
		 */
		contextPostId: uuid().references(() => post.id, { onDelete: "restrict" }),
		kind: associationKind().notNull(),
		role: text().$type<AssociationRole>().notNull(),
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
		index("unit_association_proposal_context_post_idx")
			.on(table.contextPostId)
			.where(sql`${table.contextPostId} is not null`),
		index("unit_association_proposal_created_by_idx").on(table.createdByProfileId),
		index("unit_association_proposal_resolved_by_idx").on(table.resolvedByProfileId),
		check("unit_association_proposal_role_not_blank", sql`btrim(${table.role}) <> ''`),
		/**
		 * Perhaps in the future we’ll be able to associate `unitId` with a `role` rather than `text`, which would allow us to support any role.
		 */
		check(
			"unit_association_proposal_role_check",
			sql`(
				${table.kind} = 'credit' and ${inArray(table.role, CreditAttributionRoleValues)}
			) or (
				${table.kind} = 'subject' and ${inArray(table.role, SubjectAssociationRoleValues)}
			)`,
		),
		check(
			"unit_association_proposal_context_post_shape_check",
			sql`(
				${table.kind} = 'credit' and ${table.contextPostId} is null
			) or (
				${table.kind} = 'subject'
			)`,
		),
		check(
			"unit_association_proposal_not_self_check",
			sql`${table.sourceUnitId} <> ${table.targetUnitId}`,
		),
		check("unit_association_proposal_expiry_check", sql`${table.expiresAt} > ${table.createdAt}`),
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
		role: text().$type<CreditAttributionRole>().notNull(),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
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
		index("credit_attribution_search_source_idx").on(table.creditedUnitId, table.sourceUnitId),
		index("credit_attribution_publisher_search_source_idx")
			.on(table.creditedUnitId, table.sourceUnitId)
			.where(sql`${table.role} = 'publisher'`),
		index("credit_attribution_source_position_idx").on(
			table.sourceUnitId,
			table.position,
			table.id,
		),
		check("credit_attribution_role_check", inArray(table.role, CreditAttributionRoleValues)),
		check(
			"credit_attribution_not_self_check",
			sql`${table.sourceUnitId} <> ${table.creditedUnitId}`,
		),
		createFractionalIndexPositionByteLengthConstraint(
			"credit_attribution_position_byte_length_check",
			table.position,
		),
	],
);

/**
 * A structured “is about” relationship. It does not assert contribution,
 * authorship, endorsement, or identity ownership. Its wiki context is optional.
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
		contextPostId: uuid().references(() => post.id, { onDelete: "restrict" }),
		role: text().$type<SubjectAssociationRole>().notNull(),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("subject_association_unit_entity_role_key").on(table.unitId, table.entityId, table.role),
		index("subject_association_entity_role_idx").on(table.entityId, table.role),
		index("subject_association_search_unit_idx").on(table.entityId, table.unitId),
		index("subject_association_context_post_idx")
			.on(table.contextPostId)
			.where(sql`${table.contextPostId} is not null`),
		index("subject_association_unit_position_idx").on(table.unitId, table.position, table.id),
		check("subject_association_role_check", inArray(table.role, SubjectAssociationRoleValues)),
		check("subject_association_not_self_check", sql`${table.unitId} <> ${table.entityId}`),
		createFractionalIndexPositionByteLengthConstraint(
			"subject_association_position_byte_length_check",
			table.position,
		),
	],
);

/** One Profile's global spoiler judgment for one subject appearance. */
export const subjectAssociationJudgment = pgTable(
	"subject_association_judgment",
	{
		associationId: uuid()
			.notNull()
			.references(() => subjectAssociation.id, { onDelete: "restrict" }),
		profileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		spoilerLevel: smallint().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		primaryKey({ columns: [table.associationId, table.profileId] }),
		index("subject_association_judgment_profile_idx").on(table.profileId, table.associationId),
		check(
			"subject_association_judgment_spoiler_level_check",
			sql`${table.spoilerLevel} between 0 and 2`,
		),
	],
);

/**
 * Canonical or context-specific point measurements for an Entity.
 *
 * Cross-row cardinality and context-kind checks are installed by the canonical
 * PostgreSQL guard: one canonical row plus at most eight contextual rows.
 */
export const entityMeasurement = pgTable(
	"entity_measurement",
	{
		entityId: uuid()
			.notNull()
			.references(() => entity.id, { onDelete: "restrict" }),
		contextUnitId: uuid().references(() => unit.id, { onDelete: "restrict" }),
		heightMillimetres: integer(),
		weightGrams: integer(),
		bustMillimetres: integer(),
		waistMillimetres: integer(),
		hipsMillimetres: integer(),
		sourceUrl: text().notNull(),
		sourceImportedAt: createTimestampMsColumn().notNull(),
		sourceProvenance: createJsonObjectColumn().notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		unique("entity_measurement_entity_context_key")
			.on(table.entityId, table.contextUnitId)
			.nullsNotDistinct(),
		index("entity_measurement_context_idx")
			.on(table.contextUnitId, table.entityId)
			.where(sql`${table.contextUnitId} is not null`),
		check(
			"entity_measurement_value_present_check",
			sql`num_nonnulls(
				${table.heightMillimetres},
				${table.weightGrams},
				${table.bustMillimetres},
				${table.waistMillimetres},
				${table.hipsMillimetres}
			) > 0`,
		),
		check(
			"entity_measurement_positive_check",
			sql`coalesce(${table.heightMillimetres} > 0, true)
				and coalesce(${table.weightGrams} > 0, true)
				and coalesce(${table.bustMillimetres} > 0, true)
				and coalesce(${table.waistMillimetres} > 0, true)
				and coalesce(${table.hipsMillimetres} > 0, true)`,
		),
		check("entity_measurement_source_url_check", sql`btrim(${table.sourceUrl}) <> ''`),
		check(
			"entity_measurement_source_provenance_check",
			sql`jsonb_typeof(${table.sourceProvenance}) = 'object'`,
		),
		check(
			"entity_measurement_context_not_self_check",
			sql`${table.contextUnitId} is null or ${table.contextUnitId} <> ${table.entityId}`,
		),
	],
);
