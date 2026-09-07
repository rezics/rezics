import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { runParticipationTransaction } from "../../participation/transaction";
import {
	FavoriteHistorySchema,
	FavoriteListQuerySchema,
	FavoriteListSchema,
	FavoriteMutationSchema,
	FavoriteRevisionSchema,
	SaveFavoriteSchema,
} from "../../favorites/contracts";
import {
	deleteFavorite,
	listFavoriteHistory,
	listFavorites,
	readFavoriteRevision,
	saveFavorite,
} from "../../favorites/service";

const target = z.strictObject({ targetUnitId: z.uuid() });
const revision = z.number().int().positive().safe();
const expectedRevision = z
	.number()
	.int()
	.nonnegative()
	.max(Number.MAX_SAFE_INTEGER - 1);

/** @alpha Auth-owned Favorites, independent of public Collection identities and history. */
export default new Elysia({ prefix: "/favorites", name: "favorites-api" })
	.use(session)
	.get(
		"",
		{ access: "account:read", query: FavoriteListQuerySchema, response: FavoriteListSchema },
		({ participation, query }) =>
			runParticipationTransaction((tx) => listFavorites(tx, participation, query)),
	)
	.put(
		"/:targetUnitId",
		{
			access: "write:interaction:write",
			params: target,
			body: SaveFavoriteSchema,
			response: FavoriteMutationSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				saveFavorite(tx, participation, params.targetUnitId, body),
			),
	)
	.delete(
		"/:targetUnitId",
		{
			access: "write:interaction:write",
			params: target,
			body: z.strictObject({ expectedRevision }),
			response: FavoriteMutationSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				deleteFavorite(tx, participation, params.targetUnitId, body.expectedRevision),
			),
	)
	.get(
		"/:targetUnitId/history",
		{
			access: "account:read",
			params: target,
			query: z.strictObject({
				beforeRevision: z.coerce.number().int().positive().safe().optional(),
			}),
			response: FavoriteHistorySchema,
		},
		({ participation, params, query }) =>
			runParticipationTransaction((tx) =>
				listFavoriteHistory(tx, participation, params.targetUnitId, query.beforeRevision),
			),
	)
	.get(
		"/:targetUnitId/history/:revision",
		{
			access: "account:read",
			params: target.extend({ revision: z.coerce.number().int().positive().safe() }),
			response: FavoriteRevisionSchema,
		},
		({ participation, params }) =>
			runParticipationTransaction((tx) =>
				readFavoriteRevision(tx, participation, params.targetUnitId, params.revision),
			),
	)
	.post(
		"/:targetUnitId/restore",
		{
			access: "write:interaction:write",
			params: target,
			body: z.strictObject({
				expectedRevision,
				revision,
				afterTargetId: z.uuid().nullable().optional(),
			}),
			response: FavoriteMutationSchema,
		},
		({ participation, params, body }) =>
			runParticipationTransaction((tx) =>
				saveFavorite(
					tx,
					participation,
					params.targetUnitId,
					{ expectedRevision: body.expectedRevision, afterTargetId: body.afterTargetId },
					body.revision,
				),
			),
	);
