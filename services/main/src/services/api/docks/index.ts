import { StatusCodes } from "http-status-codes";
import {
	DockDocument,
	UnresolvedBlockReferenceError,
	assertDockDocument,
	assertResolvedBlockReferences,
	parseDocument,
} from "@rezics/block";
import { and, eq, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import {
	createUnitBlockReferenceResolver,
	unitBlockGraphLockName,
} from "../../blocks/reference-resolver";
import { database } from "../../database";
import { isDockOwnerUnitKind, isDockSurfaceSupported, unit, unitDock } from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { recordUnitRevision } from "../../units/history";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import { DockDocumentInvalid, DockNotFound, DockNotSupported } from "./errors";
import { DockListResponse, DockParams, DockResponse, DockUnitParams, PutDockBody } from "./schema";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"UnitProtected",
]);

async function getDockOwner(unitId: string) {
	const [owner] = await database
		.select({ id: unit.id, kind: unit.kind })
		.from(unit)
		.where(and(eq(unit.id, unitId), isNull(unit.deletedAt)))
		.limit(1);
	if (!owner) throw new UnitNotFound();
	if (!isDockOwnerUnitKind(owner.kind)) throw new DockNotSupported();
	return owner;
}

function ensureSupported(
	owner: Awaited<ReturnType<typeof getDockOwner>>,
	surface: "main" | "wiki",
) {
	if (!isDockSurfaceSupported(owner.kind, surface)) throw new DockNotSupported();
}

function ensureDocument(value: unknown): asserts value is typeof DockDocument.static {
	try {
		assertDockDocument(value);
	} catch {
		throw new DockDocumentInvalid();
	}
}

function presentDock(record: typeof unitDock.$inferSelect) {
	return {
		...record,
		document: parseDocument(DockDocument, record.document),
	} satisfies typeof DockResponse.static;
}

export default new Elysia({ prefix: "/units/by-id" })
	.model({ DockDocument })
	.use(session)
	.get(
		"/:unitId/docks",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.unitId,
				() => new UnitNotFound(),
			);
			const owner = await getDockOwner(params.unitId);
			return {
				items: (
					await database
						.select()
						.from(unitDock)
						.where(eq(unitDock.unitId, params.unitId))
						.orderBy(unitDock.surface)
				)
					.filter((dock) => isDockSurfaceSupported(owner.kind, dock.surface))
					.map(presentDock),
			};
		},
		{
			params: DockUnitParams,
			response: {
				[StatusCodes.OK]: DockListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List configured Unit Docks", tags: ["Docks"] },
		},
	)
	.get(
		"/:unitId/docks/:surface",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request.headers, "unit:read");
			await identity.authorization.unit.ensureCanRead(
				params.unitId,
				() => new UnitNotFound(),
			);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.surface);
			const [record] = await database
				.select()
				.from(unitDock)
				.where(
					and(eq(unitDock.unitId, params.unitId), eq(unitDock.surface, params.surface)),
				)
				.limit(1);
			if (!record) throw new DockNotFound();
			return presentDock(record);
		},
		{
			params: DockParams,
			response: {
				[StatusCodes.OK]: DockResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: { summary: "Get a Unit Dock", tags: ["Docks"] },
		},
	)
	.put(
		"/:unitId/docks/:surface",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["dock", params.surface]]);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.surface);
			ensureDocument(body.document);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
				);
				try {
					await assertResolvedBlockReferences(
						body.document,
						createUnitBlockReferenceResolver(tx, {
							host: { unitId: owner.id, kind: owner.kind },
							profileId: profile.unitId,
						}),
					);
				} catch (cause) {
					if (cause instanceof UnresolvedBlockReferenceError)
						throw new DockDocumentInvalid();
					throw cause;
				}
				const [saved] = await tx
					.insert(unitDock)
					.values({
						unitId: params.unitId,
						surface: params.surface,
						document: body.document,
					})
					.onConflictDoUpdate({
						target: [unitDock.unitId, unitDock.surface],
						set: { document: body.document },
					})
					.returning();
				if (!saved) throw new Error("Dock upsert returned no row");
				await recordUnitRevision(tx, {
					unitId: params.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
				return presentDock(saved);
			});
		},
		{
			access: "contribute:unit:update",
			params: DockParams,
			body: PutDockBody,
			response: {
				[StatusCodes.OK]: DockResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"DockNotSupported",
					"DockDocumentInvalid",
				]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "Create or replace a Unit Dock", tags: ["Docks"] },
		},
	)
	.delete(
		"/:unitId/docks/:surface",
		async ({ params, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["dock", params.surface]]);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.surface);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
				);
				const deleted = await tx
					.delete(unitDock)
					.where(
						and(
							eq(unitDock.unitId, params.unitId),
							eq(unitDock.surface, params.surface),
						),
					)
					.returning({ unitId: unitDock.unitId });
				if (!deleted.length) throw new DockNotFound();
				await recordUnitRevision(tx, {
					unitId: params.unitId,
					actorProfileId: profile.unitId,
					event: "update",
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "contribute:unit:update",
			params: DockParams,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: {
				summary: "Delete a Unit Dock",
				tags: ["Docks"],
				responses: NoContentResponse,
			},
		},
	);
