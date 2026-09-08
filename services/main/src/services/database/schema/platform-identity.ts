import { sql } from "drizzle-orm";
import {
	bigint,
	boolean,
	check,
	index,
	integer,
	pgEnum,
	uuid,
	type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { PlatformOwner } from "@rezics/reference";
import { users } from "./auth";
import {
	createCreatedAtColumn,
	createTimestampMsColumn,
	createUpdatedAtColumn,
	createUuidv7PrimaryKey,
} from "./columns";
import {
	AiDisclosureValues,
	ContentRatingValues,
	ModerationStatusValues,
	ResourceVisibilityValues,
	toEnumValues,
	UnitStatusValues,
} from "./contract-values";

export const unitStatus = pgEnum("unit_status", toEnumValues(UnitStatusValues));
export const resourceVisibility = pgEnum(
	"resource_visibility",
	toEnumValues(ResourceVisibilityValues),
);
export const contentRating = pgEnum("content_rating", toEnumValues(ContentRatingValues));
export const aiDisclosure = pgEnum("ai_disclosure", toEnumValues(AiDisclosureValues));
export const moderationStatus = pgEnum("moderation_status", toEnumValues(ModerationStatusValues));

/** Common lifecycle fields belong physically to each retained platform owner; there is no identity parent row. */
export function createPlatformIdentityColumns() {
	return {
		id: createUuidv7PrimaryKey(),
		revision: bigint({ mode: "number" }).notNull().default(1),
		routingGeneration: integer().notNull().default(1),
		createdByAuthUserId: uuid().references(() => users.id, { onDelete: "restrict" }),
		status: unitStatus().notNull().default("draft"),
		visibility: resourceVisibility().notNull().default("public"),
		contentRating: contentRating().notNull().default("general"),
		aiDisclosure: aiDisclosure().notNull().default("unknown"),
		moderationStatus: moderationStatus().notNull().default("approved"),
		postTargetingLocked: boolean().notNull().default(false),
		publishedAt: createTimestampMsColumn(),
		deletedAt: createTimestampMsColumn(),
		createdAt: createCreatedAtColumn(),
		updatedAt: createUpdatedAtColumn(),
	};
}

export type PlatformIdentityColumns = {
	[Key in keyof ReturnType<typeof createPlatformIdentityColumns>]: AnyPgColumn;
};

/** Owner-local indexes keep public keyset pages and private creator/moderation lookups selective at corpus scale. */
export function platformIdentityConstraints(owner: PlatformOwner, table: PlatformIdentityColumns) {
	const published = sql`${table.status} = 'published' and ${table.visibility} = 'public' and ${table.moderationStatus} = 'approved' and ${table.deletedAt} is null`;
	return [
		check(
			`${owner}_identity_revision_check`,
			sql`${table.revision} between 1 and 9007199254740991 and ${table.routingGeneration} between 1 and 2147483647`,
		),
		check(
			`${owner}_identity_publication_check`,
			sql`${table.status} <> 'published' or ${table.publishedAt} is not null`,
		),
		check(
			`${owner}_identity_deleted_at_check`,
			sql`${table.deletedAt} is null or ${table.deletedAt} >= ${table.createdAt}`,
		),
		index(`${owner}_identity_public_created_idx`)
			.on(sql`${table.createdAt} desc`, sql`${table.id} desc`)
			.where(published),
		index(`${owner}_identity_public_updated_idx`)
			.on(sql`${table.updatedAt} desc`, sql`${table.id} desc`)
			.where(published),
		index(`${owner}_identity_public_published_idx`)
			.on(sql`${table.publishedAt} desc`, sql`${table.id} desc`)
			.where(published),
		index(`${owner}_identity_creator_idx`).on(table.createdByAuthUserId, table.id),
		index(`${owner}_identity_moderation_idx`)
			.on(table.moderationStatus, table.id)
			.where(sql`${table.deletedAt} is null`),
	];
}
