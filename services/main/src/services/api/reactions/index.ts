import { StatusCodes } from "http-status-codes";
import { and, eq, isNull, sql } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { toSafeInteger } from "../../database/integer";
import { unitReaction, unitReactionStat, unitShare } from "../../database/schema";
import { ReactionContextQuery, SetReactionBody, UnitReactionParams } from "./schema";
import {
	ReactionResponse,
	ReactionSummaryResponse,
	ShareResponse,
} from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);

function getContextCondition<T extends { realmId: typeof unitReaction.realmId }>(
	table: T,
	realmId?: string,
) {
	return realmId ? eq(table.realmId, realmId) : isNull(table.realmId);
}

export default new Elysia({ prefix: "/reactions" })
	.use(session)
	.get(
		"/units/:unitId",
		async ({ params, query, request }) => {
			const { authorization, profile } = await resolveIdentity(request, "interaction:read");
			await authorization.unit.ensureCanRead(params.unitId);
			if (query.realmId) {
				await authorization.unit.ensureCanRead(query.realmId);
			}
			const [items, viewerRows] = await Promise.all([
				database
					.select({
						reaction: unitReactionStat.reaction,
						count: unitReactionStat.reactionCount,
					})
					.from(unitReactionStat)
					.where(
						and(
							eq(unitReactionStat.unitId, params.unitId),
							query.realmId
								? eq(unitReactionStat.realmId, query.realmId)
								: isNull(unitReactionStat.realmId),
						),
					),
				profile
					? database
							.select({ reaction: unitReaction.reaction })
							.from(unitReaction)
							.where(
								and(
									eq(unitReaction.profileId, profile.unitId),
									eq(unitReaction.unitId, params.unitId),
									getContextCondition(unitReaction, query.realmId),
								),
							)
							.limit(1)
					: [],
			]);
			return {
				items: items.map((row) => ({
					reaction: row.reaction,
					count: toSafeInteger(row.count, "reaction count"),
				})),
				viewerReaction: viewerRows[0]?.reaction ?? null,
			};
		},
		{
			params: UnitReactionParams,
			query: ReactionContextQuery,
			response: {
				[StatusCodes.OK]: ReactionSummaryResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Get Unit reaction summary", tags: ["Reactions"] },
		},
	)
	.put(
		"/units/:unitId",
		async ({ params, profile, authorization, body }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			if (body.realmId) {
				await authorization.unit.ensureCanRead(body.realmId);
			}
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`${profile.unitId}:${params.unitId}:${body.realmId ?? ""}`}::text, 0))`,
				);
				await tx
					.delete(unitReaction)
					.where(
						and(
							eq(unitReaction.profileId, profile.unitId),
							eq(unitReaction.unitId, params.unitId),
							getContextCondition(unitReaction, body.realmId),
						),
					);
				await tx.insert(unitReaction).values({
					profileId: profile.unitId,
					unitId: params.unitId,
					realmId: body.realmId,
					reaction: body.reaction,
				});
			});
			return { reaction: body.reaction };
		},
		{
			access: "contribute:interaction:write",
			params: UnitReactionParams,
			body: SetReactionBody,
			response: {
				[StatusCodes.OK]: ReactionResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Set Unit reaction", tags: ["Reactions"] },
		},
	)
	.delete(
		"/units/:unitId",
		async ({ params, profile, body }) => {
			await database
				.delete(unitReaction)
				.where(
					and(
						eq(unitReaction.profileId, profile.unitId),
						eq(unitReaction.unitId, params.unitId),
						getContextCondition(unitReaction, body.realmId),
					),
				);
			return { reaction: null };
		},
		{
			access: "write:interaction:write",
			params: UnitReactionParams,
			body: SetReactionBody,
			response: { [StatusCodes.OK]: ReactionResponse },
			detail: { summary: "Remove Unit reaction", tags: ["Reactions"] },
		},
	)
	.put(
		"/shares/:unitId",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanRead(params.unitId);
			await database
				.insert(unitShare)
				.values({ profileId: profile.unitId, unitId: params.unitId })
				.onConflictDoNothing();
			return { shared: true };
		},
		{
			access: "contribute:interaction:write",
			params: UnitReactionParams,
			response: {
				[StatusCodes.OK]: ShareResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Record Unit share", tags: ["Reactions"] },
		},
	)
	.delete(
		"/shares/:unitId",
		async ({ params, profile }) => {
			await database
				.delete(unitShare)
				.where(
					and(
						eq(unitShare.profileId, profile.unitId),
						eq(unitShare.unitId, params.unitId),
					),
				);
			return { shared: false };
		},
		{
			access: "write:interaction:write",
			params: UnitReactionParams,
			response: { [StatusCodes.OK]: ShareResponse },
			detail: { summary: "Remove Unit share", tags: ["Reactions"] },
		},
	);
