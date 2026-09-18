import type { UnitOwner } from "@rezics/reference";
import { sql, type SQLWrapper } from "drizzle-orm";
import { database } from "../database";
import { post } from "@rezics/schema/postgres/forum/post";
import type {
	AiDisclosureValues,
	ContentRating,
	ModerationStatusValues,
	ResourceVisibility,
	UnitStatusValues,
} from "@rezics/schema/postgres/shared/contract-values";
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
			publishedAt: sql<Date | null>`published_at`.mapWith(post.publishedAt).as("published_at"),
			revision: sql<number>`revision`.mapWith(Number).as("revision"),
			routingGeneration: sql<number>`routing_generation`.as("routing_generation"),
			createdByAuthUserId: sql<string | null>`created_by_auth_user_id`.as(
				"created_by_auth_user_id",
			),
			deletedAt: sql<Date | null>`deleted_at`.mapWith(post.deletedAt).as("deleted_at"),
			createdAt: sql<Date>`created_at`.mapWith(post.createdAt).as("created_at"),
			updatedAt: sql<Date>`updated_at`.mapWith(post.updatedAt).as("updated_at"),
		})
		.from(sql`public.read_unit_state(${targetId}, ${includeDeleted})`)
		.as(alias);
}

/** A finite caller-owned candidate set; never discovers IDs through routing metadata. */
export function unitStatesForIds(ids: readonly string[], alias: string, includeDeleted = false) {
	if (ids.length > 500) throw new RangeError("At most 500 explicit state targets are admitted");
	const candidates = database.select({ id: sql<string>`requested.id`.as("id") })
		.from(sql`unnest(${sql.param([...new Set(ids)])}::uuid[]) requested(id)`).as("state_candidates");
	const state = unitStateRelation(candidates.id, "candidate_state", includeDeleted);
	return database.select({
		id: state.id, owner: state.owner, shape: state.shape, status: state.status,
		visibility: state.visibility, moderationStatus: state.moderationStatus,
		contentRating: state.contentRating, aiDisclosure: state.aiDisclosure,
		postTargetingLocked: state.postTargetingLocked, publishedAt: state.publishedAt,
		revision: state.revision, routingGeneration: state.routingGeneration,
		createdByAuthUserId: state.createdByAuthUserId, deletedAt: state.deletedAt,
		createdAt: state.createdAt, updatedAt: state.updatedAt,
	}).from(candidates).innerJoinLateral(state, sql`true`).as(alias);
}
