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
import { and, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import {
	createUnitBlockReferenceResolver,
	unitBlockGraphLockName,
} from "../../blocks/reference-resolver";
import { database, type DatabaseTransaction } from "../../database";
import { realm, unitDock } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import {
	createNavigationStructure,
	deleteNavigationStructure,
	listNavigationStructures,
	presentNavigationStructure,
	replaceNavigationStructure,
} from "../../content-structure/navigation";
import { getContentStructureRevision } from "../../content-structure/service";
import { ContentStructureNotFound } from "../../content-structure/errors";
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
	RealmNavigationReplaceBody,
	RealmNavigationRevisionBody,
} from "./schema";

const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);

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

function rethrowRealmNavigationNotFound(cause: unknown): never {
	if (cause instanceof ContentStructureNotFound) throw new RealmNavigationNotFound();
	throw cause;
}

function present(
	record: Awaited<ReturnType<typeof presentNavigationStructure>>,
	latestRevisionId: string,
) {
	return {
		id: record.id,
		realmId: record.ownerUnitId,
		document: record.document,
		latestRevisionId,
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
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
			return database.transaction(async (tx) => {
				const records = await listNavigationStructures(
					tx,
					params.realmId,
					"realm.navigation",
				);
				const items = [];
				for (const record of records) {
					const revisionId = await getContentStructureRevision(
						tx,
						params.realmId,
						record.id,
					);
					if (!revisionId) throw new RealmNavigationNotFound();
					items.push(present(record, revisionId));
				}
				return { items };
			});
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
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: params.realmId, kind: "realm" })}::text, 0))`,
				);
				await ensureReferences(tx, params.realmId, body.document, profile.unitId);
				const result = await createNavigationStructure(tx, {
					ownerUnitId: params.realmId,
					kind: "realm.navigation",
					document: body.document,
					actorProfileId: profile.unitId,
				});
				const record = await presentNavigationStructure(tx, {
					ownerUnitId: params.realmId,
					structureId: result.structure.id,
					kind: "realm.navigation",
				});
				return present(record, result.revisionId);
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
			return database.transaction(async (tx) => {
				try {
					const record = await presentNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "realm.navigation",
					});
					const revisionId = await getContentStructureRevision(
						tx,
						params.realmId,
						params.navigationId,
					);
					if (!revisionId) throw new RealmNavigationNotFound();
					return present(record, revisionId);
				} catch (cause) {
					if (!(cause instanceof ContentStructureNotFound)) throw cause;
					throw new RealmNavigationNotFound();
				}
			});
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
			try {
				return await database.transaction(async (tx) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: params.realmId, kind: "realm" })}::text, 0))`,
					);
					await ensureReferences(tx, params.realmId, body.document, profile.unitId);
					const result = await replaceNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "realm.navigation",
						document: body.document,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseRevisionId,
					});
					const record = await presentNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "realm.navigation",
					});
					return present(
						record,
						result.revisionCreated ? result.revisionId : body.baseRevisionId,
					);
				});
			} catch (cause) {
				rethrowRealmNavigationNotFound(cause);
			}
		},
		{
			access: "contribute:unit:update",
			params: RealmNavigationParams,
			body: RealmNavigationReplaceBody,
			response: {
				[StatusCodes.OK]: RealmNavigationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["RealmNavigationDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmNavigationNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
			},
			detail: { summary: "Replace Realm navigation", tags: ["Realms"] },
		},
	)
	.delete(
		"/:realmId/navigation/:navigationId",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.realmId, [
				["realm", "navigation", params.navigationId],
			]);
			await ensureRealm(params.realmId);
			try {
				await database.transaction(async (tx) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: params.realmId, kind: "realm" })}::text, 0))`,
					);
					const docks = await tx
						.select({ document: unitDock.document })
						.from(unitDock)
						.where(
							and(eq(unitDock.unitId, params.realmId), isNull(unitDock.deletedAt)),
						);
					if (
						docks.some((dock) =>
							collectBlockReferences(
								parseDocument(DockDocument, dock.document),
							).navigationIds.has(params.navigationId),
						)
					)
						throw new RealmNavigationInUse();
					await deleteNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "realm.navigation",
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseRevisionId,
					});
				});
			} catch (cause) {
				rethrowRealmNavigationNotFound(cause);
			}
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "contribute:unit:update",
			params: RealmNavigationParams,
			body: RealmNavigationRevisionBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"RealmNavigationNotFound",
				]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"RealmNavigationInUse",
					"ContentStructureRevisionConflict",
				]),
			},
			detail: {
				summary: "Delete Realm navigation",
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
	);
