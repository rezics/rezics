import { StatusCodes } from "http-status-codes";
import { eq } from "drizzle-orm";
import Elysia from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { database } from "../../database";
import { realm } from "../../database/schema";
import {
	deleteRealmTagSubscription,
	getUnitTagLandscape,
	listRealmTagSubscriptions,
	upsertRealmTagSubscription,
} from "../../tags/service";
import { UnitNotFound } from "../../units/errors";
import { checkUnitType } from "../catalog/service";
import { RealmNotFound } from "../realms/errors";
import { toApiErrorResponse } from "../schema/response";
import {
	RealmTagSubscriptionListQuery,
	RealmTagSubscriptionListResponse,
	RealmTagSubscriptionParams,
	RealmTagSubscriptionResponse,
	RealmTagSubscriptionStateResponse,
	UnitTagLandscapeParams,
	UnitTagLandscapeQuery,
	UnitTagLandscapeResponse,
	UpsertRealmTagSubscriptionBody,
} from "./schema";

export default new Elysia()
	.use(session)
	.group("/units", (app) =>
		app.get(
			"/:type/:unitId/tags",
			async ({ params, query, request }) => {
				await checkUnitType(params.unitId, params.type);
				const identity = await resolveIdentity(request.headers, "unit:read");
				await identity.authorization.unit.ensureCanRead(
					params.unitId,
					() => new UnitNotFound(),
				);
				return getUnitTagLandscape({
					unitId: params.unitId,
					viewerProfileId: identity.profile?.unitId,
					language: query.language,
					globalLimit: query.globalLimit ?? 50,
					sourceLimit: query.sourceLimit ?? 10,
					perRealmLimit: query.perRealmLimit ?? 12,
				});
			},
			{
				params: UnitTagLandscapeParams,
				query: UnitTagLandscapeQuery,
				response: {
					[StatusCodes.OK]: UnitTagLandscapeResponse,
					[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
				},
				detail: {
					summary: "Get global and subscribed Realm Tag assertions for a Unit",
					tags: ["Tags"],
				},
			},
		),
	)
	.group("/users", (app) =>
		app
			.get(
				"/me/tag-realm-subscriptions",
				async ({ profile, query }) => ({
					items: await listRealmTagSubscriptions({
						profileId: profile.unitId,
						language: query.language,
					}),
				}),
				{
					access: "interaction:read",
					query: RealmTagSubscriptionListQuery,
					response: { [StatusCodes.OK]: RealmTagSubscriptionListResponse },
					detail: {
						summary: "List the current user's ordered Realm Tag sources",
						tags: ["Tags"],
					},
				},
			)
			.put(
				"/me/tag-realm-subscriptions/:realmId",
				async ({ profile, authorization, params, query, body }) => {
					const [, [realmRecord]] = await Promise.all([
						authorization.unit.ensureCanRead(params.realmId, () => new RealmNotFound()),
						database
							.select({ id: realm.id })
							.from(realm)
							.where(eq(realm.id, params.realmId))
							.limit(1),
					]);
					if (!realmRecord) throw new RealmNotFound();
					return upsertRealmTagSubscription({
						profileId: profile.unitId,
						realmId: params.realmId,
						position: body.position,
						language: query.language,
					});
				},
				{
					access: "contribute:interaction:write",
					params: RealmTagSubscriptionParams,
					query: RealmTagSubscriptionListQuery,
					body: UpsertRealmTagSubscriptionBody,
					response: {
						[StatusCodes.OK]: RealmTagSubscriptionResponse,
						[StatusCodes.NOT_FOUND]: toApiErrorResponse(["RealmNotFound"]),
					},
					detail: {
						summary: "Subscribe to or reorder a Realm Tag source",
						tags: ["Tags"],
					},
				},
			)
			.delete(
				"/me/tag-realm-subscriptions/:realmId",
				async ({ profile, params }) => {
					await deleteRealmTagSubscription(profile.unitId, params.realmId);
					return { realmId: params.realmId, subscribed: false };
				},
				{
					access: "write:interaction:write",
					params: RealmTagSubscriptionParams,
					response: { [StatusCodes.OK]: RealmTagSubscriptionStateResponse },
					detail: {
						summary: "Unsubscribe from a Realm Tag source",
						tags: ["Tags"],
					},
				},
			),
	);
