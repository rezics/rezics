import { unitReferenceColumns, unitReferenceConstraints } from "../shared/unit-reference-columns";
import { inArray, sql } from "drizzle-orm";
import {
	check,
	index,
	jsonb,
	pgEnum,
	primaryKey,
	smallint,
	text,
	unique,
	uuid,
} from "drizzle-orm/pg-core";

import { pgTable } from "../shared/base";
import { users } from "./auth";
import { participationGrant, servicePrincipal } from "../access/participation";
import type { ParticipationAuthority } from "@rezics/schema/contracts/native/authority";
import { entityIdentity } from "../catalog/identity";
import {
	createCreatedAtColumn,
	createFractionalIndexPositionByteLengthConstraint,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
	fractionalIndexPosition,
} from "../shared/columns";
import {
	AssociationKindValues,
	AssociationProposalDirectionValues,
	AssociationProposalResolutionValues,
	type AssociationRole,
	type CreditAttributionRole,
	CreditAttributionRoleValues,
	type SubjectAssociationRole,
	SubjectAssociationRoleValues,
	toEnumValues,
} from "../shared/contract-values";
import { post } from "../forum/post";

export const associationKind = pgEnum("association_kind", toEnumValues(AssociationKindValues));
export const associationProposalDirection = pgEnum(
	"association_proposal_direction",
	toEnumValues(AssociationProposalDirectionValues),
);
export const associationProposalResolution = pgEnum(
	"association_proposal_resolution",
	toEnumValues(AssociationProposalResolutionValues),
);

/** Two-sided consent workflow for a relationship stored on a source Unit. */
export const unitAssociationProposal = pgTable(
	"unit_association_proposal",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid().notNull(),
		targetUnitId: uuid().notNull(),
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
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		/** Private admitted principal/grant; excluded from every public proposal response. */
		creatorAuthority: jsonb().$type<ParticipationAuthority>().notNull(),
		creatorAuthUserId: uuid()
			.generatedAlwaysAs(sql`(creator_authority->'principal'->>'authUserId')::uuid`)
			.notNull()
			.references(() => users.id, { onDelete: "restrict" }),
		creatorGrantId: uuid()
			.generatedAlwaysAs(sql`(creator_authority->'grant'->>'id')::uuid`)
			.references(() => participationGrant.id, { onDelete: "restrict" }),
		creatorServicePrincipalId: uuid()
			.generatedAlwaysAs(sql`(creator_authority->'principal'->>'servicePrincipalId')::uuid`)
			.references(() => servicePrincipal.id, { onDelete: "restrict" }),
		expiresAt: createTimestampMsColumn().notNull(),
		resolution: associationProposalResolution(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByProfileId: uuid().references(() => entityIdentity.id, { onDelete: "restrict" }),
		resolvedByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("sourceUnit", "cascade"),
		...unitReferenceColumns("targetUnit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints(
			"unit_association_proposal",
			"sourceUnit",
			table,
			false,
			table.sourceUnitId,
		),
		...unitReferenceConstraints(
			"unit_association_proposal",
			"targetUnit",
			table,
			false,
			table.targetUnitId,
		),

		index("unit_association_proposal_source_unresolved_idx")
			.on(table.sourceUnitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_association_proposal_target_unresolved_idx")
			.on(table.targetUnitId, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.resolution} is null`),
		index("unit_association_proposal_context_post_idx")
			.on(table.contextPostId)
			.where(sql`${table.contextPostId} is not null`),
		index("unit_association_proposal_source_page_idx").on(
			table.sourceUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_association_proposal_target_page_idx").on(
			table.targetUnitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_association_proposal_creator_auth_idx").on(table.creatorAuthUserId, table.id),
		index("unit_association_proposal_creator_grant_idx")
			.on(table.creatorGrantId)
			.where(sql`${table.creatorGrantId} is not null`),
		index("unit_association_proposal_creator_service_idx")
			.on(table.creatorServicePrincipalId)
			.where(sql`${table.creatorServicePrincipalId} is not null`),
		check(
			"unit_association_proposal_authority_shape_check",
			sql`jsonb_typeof(${table.creatorAuthority})='object' and octet_length(${table.creatorAuthority}::text)<=4096`,
		),
		index("unit_association_proposal_created_by_idx").on(table.createdByProfileId),
		index("unit_association_proposal_resolved_auth_idx")
			.on(table.resolvedByAuthUserId)
			.where(sql`${table.resolvedByAuthUserId} is not null`),
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
				${table.resolution} is null and ${table.resolvedAt} is null and ${table.resolvedByProfileId} is null and ${table.resolvedByAuthUserId} is null
			) or (
				${table.resolution} is not null and ${table.resolvedAt} is not null and ${table.resolvedByProfileId} is not null and ${table.resolvedByAuthUserId} is not null
			)`,
		),
	],
);

/** Author, translator, publisher, and other contribution relationships. */
export const creditAttribution = pgTable(
	"credit_attribution",
	{
		id: createUuidv7PrimaryKey(),
		sourceUnitId: uuid().notNull(),
		creditedEntityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		role: text().$type<CreditAttributionRole>().notNull(),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("sourceUnit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints(
			"credit_attribution",
			"sourceUnit",
			table,
			false,
			table.sourceUnitId,
		),

		unique("credit_attribution_source_credited_role_key").on(
			table.sourceUnitId,
			table.creditedEntityId,
			table.role,
		),
		index("credit_attribution_credited_entity_role_idx").on(table.creditedEntityId, table.role),
		index("credit_attribution_search_source_idx").on(table.creditedEntityId, table.sourceUnitId),
		index("credit_attribution_publisher_search_source_idx")
			.on(table.creditedEntityId, table.sourceUnitId)
			.where(sql`${table.role} = 'publisher'`),
		index("credit_attribution_source_position_idx").on(
			table.sourceUnitId,
			table.position,
			table.id,
		),
		check("credit_attribution_role_check", inArray(table.role, CreditAttributionRoleValues)),
		check(
			"credit_attribution_not_self_check",
			sql`${table.sourceUnitId} <> ${table.creditedEntityId}`,
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
		unitId: uuid().notNull(),
		entityId: uuid()
			.notNull()
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
		contextPostId: uuid().references(() => post.id, { onDelete: "restrict" }),
		role: text().$type<SubjectAssociationRole>().notNull(),
		position: fractionalIndexPosition().default(sql`'a0'::text`).notNull(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),

		...unitReferenceColumns("unit", "cascade"),
	},
	(table) => [
		...unitReferenceConstraints("subject_association", "unit", table, false, table.unitId),

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
			.references(() => entityIdentity.id, { onDelete: "restrict" }),
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
