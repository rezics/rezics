import type { StaticDecode } from "typebox";
import { DevelopmentPreviewCapability } from "@rezics/access";
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
import { AuthenticationRequired } from "../../auth/errors";
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
	WikiNavigationDocumentInvalid,
	WikiNavigationInUse,
	WikiNavigationNotFound,
} from "../realms/errors";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	WikiNavigationBody,
	WikiNavigationListResponse,
	WikiNavigationOwnerParams,
	WikiNavigationParams,
	WikiNavigationResponse,
	WikiNavigationReplaceBody,
	WikiNavigationRevisionBody,
} from "./schema";

const AuthenticationRequiredResponse = toApiErrorResponse(["AuthenticationRequired"]);
const WikiNavigationReadForbiddenResponse = toApiErrorResponse(["PlatformCapabilityRequired"]);
const WikiNavigationMutationForbiddenResponse = toApiErrorResponse([
	"PlatformCapabilityRequired",
	"UnitPermissionForbidden",
]);
const DevelopmentPreviewDescription =
	"Development preview. Requires platform.development_preview.access in addition to ordinary Realm Wiki navigation authorization.";

async function ensureRealm(realmId: string): Promise<void> {
	const [record] = await database
		.select({ id: realm.id })
		.from(realm)
		.where(eq(realm.id, realmId))
		.limit(1);
	if (!record) throw new UnitNotFound("Realm");
}

function ensureDocument(value: unknown): asserts value is StaticDecode<typeof NavigationDocument> {
	try {
		assertNavigationDocument(value, { allowExternalNavigation: false });
	} catch {
		throw new WikiNavigationDocumentInvalid();
	}
}

function rethrowWikiNavigationNotFound(cause: unknown): never {
	if (cause instanceof ContentStructureNotFound) throw new WikiNavigationNotFound();
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
	} satisfies StaticDecode<typeof WikiNavigationResponse>;
}

async function ensureReferences(
	tx: DatabaseTransaction,
	realmId: string,
	document: StaticDecode<typeof NavigationDocument>,
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
		if (cause instanceof UnresolvedBlockReferenceError) throw new WikiNavigationDocumentInvalid();
		throw cause;
	}
}

export default new Elysia({ prefix: "/realms" })
	.use(session)
	.get(
		"/:realmId/wiki/navigation",
		{
			params: WikiNavigationOwnerParams,
			response: {
				[StatusCodes.OK]: WikiNavigationListResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: WikiNavigationReadForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				summary: "List Realm Wiki navigation resources",
				description: DevelopmentPreviewDescription,
				tags: ["Realms"],
			},
		},
		async ({ params, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			if (!identity.profile) throw new AuthenticationRequired();
			await identity.authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await identity.authorization.unit.ensureCanRead(
				params.realmId,
				() => new UnitNotFound("Realm"),
			);
			await ensureRealm(params.realmId);
			return database.transaction(async (tx) => {
				const records = await listNavigationStructures(tx, params.realmId, "wiki.navigation");
				return {
					items: records.map((record) => present(record, record.latestRevisionId)),
				};
			});
		},
	)
	.post(
		"/:realmId/wiki/navigation",
		{
			access: "contribute:unit:update",
			params: WikiNavigationOwnerParams,
			body: WikiNavigationBody,
			response: {
				[StatusCodes.OK]: WikiNavigationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["WikiNavigationDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: WikiNavigationMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: {
				summary: "Create Realm Wiki navigation",
				description: DevelopmentPreviewDescription,
				tags: ["Realms"],
			},
		},
		async ({ params, body, profile, authorization }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await authorization.unit.ensureCanUpdate(params.realmId, [["wiki", "navigation"]]);
			await ensureRealm(params.realmId);
			ensureDocument(body.document);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: params.realmId, kind: "realm" })}::text, 0))`,
				);
				await ensureReferences(tx, params.realmId, body.document, profile.unitId);
				const result = await createNavigationStructure(tx, {
					ownerUnitId: params.realmId,
					kind: "wiki.navigation",
					document: body.document,
					actorProfileId: profile.unitId,
				});
				const record = await presentNavigationStructure(tx, {
					ownerUnitId: params.realmId,
					structureId: result.structure.id,
					kind: "wiki.navigation",
				});
				return present(record, result.revisionId);
			});
		},
	)
	.get(
		"/:realmId/wiki/navigation/:navigationId",
		{
			params: WikiNavigationParams,
			response: {
				[StatusCodes.OK]: WikiNavigationResponse,
				[StatusCodes.UNAUTHORIZED]: AuthenticationRequiredResponse,
				[StatusCodes.FORBIDDEN]: WikiNavigationReadForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "WikiNavigationNotFound"]),
			},
			detail: {
				summary: "Get Realm Wiki navigation",
				description: DevelopmentPreviewDescription,
				tags: ["Realms"],
			},
		},
		async ({ params, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			if (!identity.profile) throw new AuthenticationRequired();
			await identity.authorization.platform.ensureCapability(DevelopmentPreviewCapability);
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
						kind: "wiki.navigation",
					});
					const revisionId = await getContentStructureRevision(
						tx,
						params.realmId,
						params.navigationId,
					);
					if (!revisionId) throw new WikiNavigationNotFound();
					return present(record, revisionId);
				} catch (cause) {
					if (!(cause instanceof ContentStructureNotFound)) throw cause;
					throw new WikiNavigationNotFound();
				}
			});
		},
	)
	.put(
		"/:realmId/wiki/navigation/:navigationId",
		{
			access: "contribute:unit:update",
			params: WikiNavigationParams,
			body: WikiNavigationReplaceBody,
			response: {
				[StatusCodes.OK]: WikiNavigationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["WikiNavigationDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: WikiNavigationMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "WikiNavigationNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["ContentStructureRevisionConflict"]),
			},
			detail: {
				summary: "Replace Realm Wiki navigation",
				description: DevelopmentPreviewDescription,
				tags: ["Realms"],
			},
		},
		async ({ params, body, profile, authorization }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await authorization.unit.ensureCanUpdate(params.realmId, [
				["wiki", "navigation", params.navigationId],
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
						kind: "wiki.navigation",
						document: body.document,
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseRevisionId,
					});
					const record = await presentNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "wiki.navigation",
					});
					return present(record, result.revisionCreated ? result.revisionId : body.baseRevisionId);
				});
			} catch (cause) {
				rethrowWikiNavigationNotFound(cause);
			}
		},
	)
	.delete(
		"/:realmId/wiki/navigation/:navigationId",
		{
			access: "contribute:unit:update",
			params: WikiNavigationParams,
			body: WikiNavigationRevisionBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.FORBIDDEN]: WikiNavigationMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "WikiNavigationNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"WikiNavigationInUse",
					"ContentStructureRevisionConflict",
				]),
			},
			detail: {
				summary: "Delete Realm Wiki navigation",
				description: DevelopmentPreviewDescription,
				tags: ["Realms"],
				responses: NoContentResponse,
			},
		},
		async ({ params, body, profile, authorization }) => {
			await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			await authorization.unit.ensureCanUpdate(params.realmId, [
				["wiki", "navigation", params.navigationId],
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
						.where(and(eq(unitDock.unitId, params.realmId), isNull(unitDock.deletedAt)));
					if (
						docks.some((dock) =>
							collectBlockReferences(parseDocument(DockDocument, dock.document)).navigationIds.has(
								params.navigationId,
							),
						)
					)
						throw new WikiNavigationInUse();
					await deleteNavigationStructure(tx, {
						ownerUnitId: params.realmId,
						structureId: params.navigationId,
						kind: "wiki.navigation",
						actorProfileId: profile.unitId,
						baseRevisionId: body.baseRevisionId,
					});
				});
			} catch (cause) {
				rethrowWikiNavigationNotFound(cause);
			}
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	);
