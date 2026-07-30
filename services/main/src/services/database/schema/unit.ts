import type { PublicationLicenseId } from "@rezics/license";
import { inArray, sql } from "drizzle-orm";
import { boolean, check, index, pgEnum, text, unique } from "drizzle-orm/pg-core";

import { pgTable } from "./base";
import {
	AiDisclosureValues,
	ContentRatingValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	toEnumValues,
	type UnitKind,
	UnitKindValues,
	UnitStatusValues,
} from "./contract-values";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";

export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const resourceVisibility = pgEnum(
	"resource_visibility",
	toEnumValues(ResourceVisibilityValues),
);
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));

export const unit = pgTable(
	"unit",
	{
		id: createUuidv7PrimaryKey(),
		kind: text().$type<UnitKind>().notNull(),
		status: unitStatus().default("draft").notNull(),
		visibility: resourceVisibility().default("public").notNull(),
		contentRating: contentRating().default("general").notNull(),
		aiDisclosure: aiDisclosure().default("unknown").notNull(),
		/** Public-facing License selected for this Unit's work; never a grant to REZICS. */
		license: text().$type<PublicationLicenseId>(),
		moderationStatus: moderationStatus().default("approved").notNull(),
		/** Rejects creation of new Post relations that target this Unit. */
		postTargetingLocked: boolean().default(false).notNull(),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	},
	(table) => [
		index("unit_kind_status_created_at_idx")
			.on(table.kind, table.status, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_status_visibility_created_at_idx")
			.on(table.status, table.visibility, table.createdAt.desc(), table.id.desc())
			.where(sql`${table.deletedAt} is null`),
		index("unit_moderation_status_idx").on(table.moderationStatus),
		unique("unit_id_kind_key").on(table.id, table.kind),
		check("unit_kind_check", inArray(table.kind, UnitKindValues)),
		check(
			"unit_publication_check",
			sql`${table.status} <> 'published'::unit_status or ${table.publishedAt} is not null`,
		),
		check(
			"unit_deleted_at_check",
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
	],
);
