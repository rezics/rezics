import { StatusCodes } from "http-status-codes";
import {
	DockDocument,
	NavigationDocument,
	UnresolvedBlockReferenceError,
	assertNavigationDocument,
	assertResolvedNavigationReferences,
	collectBlockReferences,
	parseDocument,
} from "@rezics/block";
import { and, eq, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import { createUnitBlockReferenceResolver } from "../../blocks/reference-resolver";
import { database, type DatabaseTransaction } from "../../database";
import { realm, realmNavigation, unitDock } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import {
	RealmNavigationDocumentInvalid,
	RealmNavigationInUse,
	RealmNavigationNotFound,
} from "../realms/errors";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	RealmNavigationBody,
	RealmNavigationListResponse,
	RealmNavigationOwnerParams,
	RealmNavigationParams,
	RealmNavigationResponse,
} from "./schema";

const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);

async function ensureRealm(realmId: string): Promise<void> {
	const [record] = await database
		.select({ id: realm.id })
		.from(realm)
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new UnitNotFound("Realm");
}

function ensureDocument(value: unknown): asserts value is typeof NavigationDocument.static {
	try {
		assertNavigationDocument(value, { allowExternalNavigation: true });
	} catch {
		throw new RealmNavigationDocumentInvalid();
	}
}

function present(record: typeof realmNavigation.$inferSelect) {
	return {
		...record,
		document: parseDocument(NavigationDocument, record.document),
	} satisfies typeof RealmNavigationResponse.static;
}

async function ensureReferences(
	tx: DatabaseTransaction,
	realmId: string,
	document: typeof NavigationDocument.static,
	profileId: string,
): Promise<void> {
	try {
		await assertResolvedNavigationReferences(
			document,
			createUnitBlockReferenceResolver(tx, {
				host: { unitId: realmId, kind: "realm" },
				profileId,
			}),
		);
	} catch (cause) {
		if (cause instanceof UnresolvedBlockReferenceError)
			throw new RealmNavigationDocumentInvalid();
		throw cause;
	}
}

export default new Elysia({ prefix: "/realms" })
	.model({ NavigationDocument })
	.use(session)
	.get(
		"/:realmId/navigation",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.realmId,
				() => new UnitNotFound("Realm"),
			);
			await ensureRealm(params.realmId);
			return {
				items: (
					await database
						.select()
						.from(realmNavigation)
						.where(eq(realmNavigation.realmId, params.realmId))
						.orderBy(realmNavigation.createdAt, realmNavigation.id)
				).map(present),
			};
		},
		{
			params: RealmNavigationOwnerParams,
			response: {
				[StatusCodes.OK]: RealmNavigationListResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List Realm navigation resources", tags: ["Realms"] },
		},
	)
	.post(
		"/:realmId/navigation",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.realmId, [["realm", "navigation"]]);
			await ensureRealm(params.realmId);
			ensureDocument(body.document);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`realm-graph:${params.realmId}`}::text, 0))`,
				);
				await ensureReferences(tx, params.realmId, body.document, profile.unitId);
				const [saved] = await tx
					.insert(realmNavigation)
					.values({ realmId: params.realmId, document: body.document })
					.returning();
				if (!saved) throw new Error("Realm navigation insert returned no row");
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return present(saved);
			});
		},
		{
			access: "contribute:unit:update",
			params: RealmNavigationOwnerParams,
			body: RealmNavigationBody,
			response: {
				[StatusCodes.OK]: RealmNavigationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["RealmNavigationDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "Create Realm navigation", tags: ["Realms"] },
		},
	)
	.get(
		"/:realmId/navigation/:navigationId",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.realmId,
				() => new UnitNotFound("Realm"),
			);
			await ensureRealm(params.realmId);
			const [record] = await database
				.select()
				.from(realmNavigation)
				.where(
					and(
						eq(realmNavigation.realmId, params.realmId),
						eq(realmNavigation.id, params.navigationId),
					),
				)
				.limit(1);
			if (!record) throw new RealmNavigationNotFound();
			return present(record);
		},
		{
			params: RealmNavigationParams,
			response: {
				[StatusCodes.OK]: RealmNavigationResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmNavigationNotFound",
				]),
			},
			detail: { summary: "Get Realm navigation", tags: ["Realms"] },
		},
	)
	.put(
		"/:realmId/navigation/:navigationId",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.realmId, [
				["realm", "navigation", params.navigationId],
			]);
			await ensureRealm(params.realmId);
			ensureDocument(body.document);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`realm-graph:${params.realmId}`}::text, 0))`,
				);
				await ensureReferences(tx, params.realmId, body.document, profile.unitId);
				const [saved] = await tx
					.update(realmNavigation)
					.set({ document: body.document })
					.where(
						and(
							eq(realmNavigation.realmId, params.realmId),
							eq(realmNavigation.id, params.navigationId),
						),
					)
					.returning();
				if (!saved) throw new RealmNavigationNotFound();
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return present(saved);
			});
		},
		{
			access: "contribute:unit:update",
			params: RealmNavigationParams,
			body: RealmNavigationBody,
			response: {
				[StatusCodes.OK]: RealmNavigationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["RealmNavigationDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmNavigationNotFound",
				]),
			},
			detail: { summary: "Replace Realm navigation", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/navigation/:navigationId",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.realmId, [
				["realm", "navigation", params.navigationId],
			]);
			await ensureRealm(params.realmId);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${`realm-graph:${params.realmId}`}::text, 0))`,
				);
				const [target] = await tx
					.select({ id: realmNavigation.id })
					.from(realmNavigation)
					.where(
						and(
							eq(realmNavigation.realmId, params.realmId),
							eq(realmNavigation.id, params.navigationId),
						),
					)
					.limit(1);
				if (!target) throw new RealmNavigationNotFound();
				const docks = await tx
					.select({ document: unitDock.document })
					.from(unitDock)
					.where(eq(unitDock.unitId, params.realmId));
				if (
					docks.some((dock) =>
						collectBlockReferences(
							parseDocument(DockDocument, dock.document),
						).navigationIds.has(target.id),
					)
				)
					throw new RealmNavigationInUse();
				await tx.delete(realmNavigation).where(eq(realmNavigation.id, target.id));
				await recordUnitRevision(tx, {
					unitId: params.realmId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "contribute:unit:update",
			params: RealmNavigationParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmNavigationNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["RealmNavigationInUse"]),
			},
			detail: {
				summary: "Delete Realm navigation",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	);
