import { inArray, sql } from "drizzle-orm";
import { check, index, pgEnum, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import { profile, unit } from "./core";
import {
	toEnumValues,
	UnitOwnershipClaimResolutionValues,
	type UnitOwnershipClaimResolution,
} from "./contract-values";
import { unitOwnership } from "./access";

export const unitOwnershipClaimResolution = pgEnum(
	"unit_ownership_claim_resolution",
	toEnumValues(UnitOwnershipClaimResolutionValues),
);

/**
 * One request to return a community-owned public catalog entry to its claimant.
 *
 * Resolved rows are historical workflow records. Effective authority always
 * comes from `unit_ownership`, never from this table.
 */
export const unitOwnershipClaim = pgTable(
	"unit_ownership_claim",
	{
		id: createUuidv7PrimaryKey(),
		unitId: uuid()
			.notNull()
			.references(() => unit.id, { onDelete: "restrict" }),
		claimantProfileId: uuid()
			.notNull()
			.references(() => profile.id, { onDelete: "restrict" }),
		sourceOwnershipId: uuid()
			.notNull()
			.references(() => unitOwnership.id, { onDelete: "restrict" }),
		/** Claimant-authored ownership basis and supporting public references. */
		details: text().notNull(),
		resolution: unitOwnershipClaimResolution().$type<UnitOwnershipClaimResolution>(),
		resolvedAt: createTimestampMsColumn(),
		resolvedByProfileId: uuid().references(() => profile.id, { onDelete: "restrict" }),
		resultingOwnershipId: uuid().references(() => unitOwnership.id, {
			onDelete: "restrict",
		}),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		uniqueIndex("unit_ownership_claim_pending_profile_unit_key")
			.on(table.unitId, table.claimantProfileId)
			.where(sql`${table.resolution} is null`),
		uniqueIndex("unit_ownership_claim_resulting_ownership_key")
			.on(table.resultingOwnershipId)
			.where(sql`${table.resultingOwnershipId} is not null`),
		index("unit_ownership_claim_pending_created_at_idx")
			.on(table.createdAt, table.id)
			.where(sql`${table.resolution} is null`),
		index("unit_ownership_claim_unit_created_at_idx").on(
			table.unitId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_ownership_claim_claimant_created_at_idx").on(
			table.claimantProfileId,
			table.createdAt.desc(),
			table.id.desc(),
		),
		index("unit_ownership_claim_source_ownership_idx").on(table.sourceOwnershipId),
		check("unit_ownership_claim_details_not_blank", sql`btrim(${table.details}) <> ''`),
		check("unit_ownership_claim_details_length", sql`char_length(${table.details}) <= 2000`),
		check(
			"unit_ownership_claim_resolution_current_check",
			inArray(table.resolution, UnitOwnershipClaimResolutionValues),
		),
		check(
			"unit_ownership_claim_resolution_shape_check",
			sql`(
				${table.resolution} is null
				and ${table.resolvedAt} is null
				and ${table.resolvedByProfileId} is null
				and ${table.resultingOwnershipId} is null
			) or (
				${table.resolution} = 'approved'
				and ${table.resolvedAt} is not null
				and ${table.resolvedByProfileId} is not null
				and ${table.resultingOwnershipId} is not null
			) or (
				${table.resolution} in ('rejected', 'withdrawn', 'superseded')
				and ${table.resolvedAt} is not null
				and ${table.resolvedByProfileId} is not null
				and ${table.resultingOwnershipId} is null
			)`,
		),
		check(
			"unit_ownership_claim_distinct_ownership_check",
			sql`${table.resultingOwnershipId} is null or ${table.resultingOwnershipId} <> ${table.sourceOwnershipId}`,
		),
	],
);
