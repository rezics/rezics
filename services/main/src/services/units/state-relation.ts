import type { UnitOwner } from "@rezics/reference";
import { sql, type SQLWrapper } from "drizzle-orm";
import { database } from "../database";
import type {
	AiDisclosureValues,
	ContentRating,
	ModerationStatusValues,
	ResourceVisibility,
	UnitStatusValues,
} from "../database/schema/contract-values";
type AiDisclosure = (typeof AiDisclosureValues)[number];
type ModerationStatus = (typeof ModerationStatusValues)[number];
type UnitStatus = (typeof UnitStatusValues)[number];

/**
 * Correlated one-owner state lookup. List callers must cap their source candidate
 * subquery before this lateral join and advance the cursor over consumed candidates.
 * This internal projection contains private creator identity; never return it wholesale.
 */
export function unitStateRelation(targetId: SQLWrapper, alias: string, includeDeleted = false) {
	return database
		.select({
			id: sql<string>`id`.as("id"),
			owner: sql<UnitOwner>`owner`.as("owner"),
			shape: sql<string>`shape`.as("shape"),
			status: sql<UnitStatus>`status`.as("status"),
			visibility: sql<ResourceVisibility>`visibility`.as("visibility"),
			contentRating: sql<ContentRating>`content_rating`.as("content_rating"),
			moderationStatus: sql<ModerationStatus>`moderation_status`.as("moderation_status"),
			aiDisclosure: sql<AiDisclosure | null>`ai_disclosure`.as("ai_disclosure"),
			postTargetingLocked: sql<boolean | null>`post_targeting_locked`.as("post_targeting_locked"),
			publishedAt: sql<Date | null>`published_at`.as("published_at"),
			revision: sql<number>`revision`.mapWith(Number).as("revision"),
			routingGeneration: sql<number>`routing_generation`.as("routing_generation"),
			createdByAuthUserId: sql<string | null>`created_by_auth_user_id`.as(
				"created_by_auth_user_id",
			),
			deletedAt: sql<Date | null>`deleted_at`.as("deleted_at"),
			createdAt: sql<Date>`created_at`.as("created_at"),
			updatedAt: sql<Date>`updated_at`.as("updated_at"),
		})
		.from(sql`public.read_unit_state(${targetId}, ${includeDeleted})`)
		.as(alias);
}
