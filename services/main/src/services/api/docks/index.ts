import { StatusCodes } from "http-status-codes";
import {
	DockDocument,
	DockBlockHostPolicy,
	UnresolvedBlockReferenceError,
	assertBlockQueryBudget,
	assertDockDocument,
	assertResolvedBlockReferences,
	parseDocument,
} from "@rezics/block";
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";

import session, { resolveIdentity } from "../../auth/session";
import {
	createUnitBlockReferenceResolver,
	unitBlockGraphLockName,
} from "../../blocks/reference-resolver";
import { database, type DatabaseTransaction } from "../../database";
import {
	dockRevisionHead,
	isDockOwnerUnitKind,
	isDockKindSupported,
	unit,
	unitDock,
} from "../../database/schema";
import { UnitNotFound } from "../../units/errors";
import { assertExecutableBlockFilterDocuments } from "../../search/block-filter-documents";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	DockDocumentInvalid,
	DockNotFound,
	DockNotSupported,
	DockRevisionConflict,
} from "./errors";
import {
	DockListResponse,
	DockMutationResponse,
	DockParams,
	DockResponse,
	DockRevisionBody,
	DockRevisionListQuery,
	DockRevisionListResponse,
	DockRevisionParams,
	DockUnitParams,
	PutDockBody,
} from "./schema";
import {
	createDockHistory,
	deleteDockHistory,
	getDockRevisionId,
	listDockRevisions,
	lockDockHistory,
	restoreDockRevision,
	updateDockHistory,
} from "./history";

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse(["UnitPermissionForbidden"]);

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

function ensureSupported(owner: Awaited<ReturnType<typeof getDockOwner>>, kind: "main" | "wiki") {
	if (!isDockKindSupported(owner.kind, kind)) throw new DockNotSupported();
}

function ensureDocument(value: unknown): asserts value is typeof DockDocument.static {
	try {
		assertDockDocument(value);
		assertBlockQueryBudget(value, DockBlockHostPolicy);
		assertExecutableBlockFilterDocuments(value, true);
	} catch {
		throw new DockDocumentInvalid();
	}
}

function presentDock(record: typeof unitDock.$inferSelect, latestRevisionId: string) {
	return {
		id: record.id,
		unitId: record.unitId,
		kind: record.kind,
		latestRevisionId,
		document: parseDocument(DockDocument, record.document),
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	} satisfies typeof DockResponse.static;
}

async function ensureResolvedDockReferences(
	tx: DatabaseTransaction,
	input: {
		readonly document: typeof DockDocument.static;
		readonly owner: Awaited<ReturnType<typeof getDockOwner>>;
		readonly profileId: string;
	},
): Promise<void> {
	try {
		await assertResolvedBlockReferences(
			input.document,
			createUnitBlockReferenceResolver(tx, {
				host: { unitId: input.owner.id, kind: input.owner.kind },
				profileId: input.profileId,
			}),
		);
	} catch (cause) {
		if (cause instanceof UnresolvedBlockReferenceError) throw new DockDocumentInvalid();
		throw cause;
	}
}

export default new Elysia({ prefix: "/units/by-id" })
	.model({ DockDocument })
	.use(session)
	.get(
		"/:unitId/docks",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(params.unitId, () => new UnitNotFound());
			const owner = await getDockOwner(params.unitId);
			return database.transaction(async (tx) => {
				const records = await tx
					.select({
						...getTableColumns(unitDock),
						latestRevisionId: dockRevisionHead.revisionId,
					})
					.from(unitDock)
					.leftJoin(dockRevisionHead, eq(dockRevisionHead.dockId, unitDock.id))
					.where(and(eq(unitDock.unitId, params.unitId), isNull(unitDock.deletedAt)))
					.orderBy(unitDock.kind);
				const items = [];
				for (const dock of records) {
					if (!isDockKindSupported(owner.kind, dock.kind)) continue;
					if (!dock.latestRevisionId) throw new DockNotFound();
					items.push(presentDock(dock, dock.latestRevisionId));
				}
				return { items };
			});
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
		"/:unitId/docks/:kind",
		async ({ params, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(params.unitId, () => new UnitNotFound());
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			const [record] = await database
				.select()
				.from(unitDock)
				.where(
					and(
						eq(unitDock.unitId, params.unitId),
						eq(unitDock.kind, params.kind),
						isNull(unitDock.deletedAt),
					),
				)
				.limit(1);
			if (!record) throw new DockNotFound();
			const latestRevisionId = await database.transaction((tx) => getDockRevisionId(tx, record.id));
			if (!latestRevisionId) throw new DockNotFound();
			return presentDock(record, latestRevisionId);
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
		"/:unitId/docks/:kind",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["dock", params.kind]]);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			ensureDocument(body.document);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
				);
				await ensureResolvedDockReferences(tx, {
					document: body.document,
					owner,
					profileId: profile.unitId,
				});
				const [current] = await tx
					.select()
					.from(unitDock)
					.where(and(eq(unitDock.unitId, params.unitId), eq(unitDock.kind, params.kind)))
					.limit(1);
				if (current) {
					const latestRevisionId = await getDockRevisionId(tx, current.id);
					if (current.deletedAt) throw new DockRevisionConflict(latestRevisionId);
					const baseRevisionId = body.baseRevisionId;
					if (!baseRevisionId) throw new DockRevisionConflict(latestRevisionId);
					await lockDockHistory(tx, current.id);
					const [saved] = await tx
						.update(unitDock)
						.set({ document: body.document, updatedAt: new Date() })
						.where(eq(unitDock.id, current.id))
						.returning();
					if (!saved) throw new Error("Dock update returned no row");
					const revision = await updateDockHistory(tx, {
						dock: saved,
						baseRevisionId,
						actorProfileId: profile.unitId,
					});
					return presentDock(saved, revision.revisionId);
				}
				if (body.baseRevisionId) throw new DockRevisionConflict(null);
				const [saved] = await tx
					.insert(unitDock)
					.values({
						unitId: params.unitId,
						kind: params.kind,
						document: body.document,
					})
					.returning();
				if (!saved) throw new Error("Dock insertion returned no row");
				const revision = await createDockHistory(tx, {
					dock: saved,
					actorProfileId: profile.unitId,
				});
				return presentDock(saved, revision.revisionId);
			});
		},
		{
			access: "contribute:unit:update",
			params: DockParams,
			body: PutDockBody,
			response: {
				[StatusCodes.OK]: DockResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported", "DockDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["DockRevisionConflict"]),
			},
			detail: { summary: "Create or replace a Unit Dock", tags: ["Docks"] },
		},
	)
	.get(
		"/:unitId/docks/:kind/revisions",
		async ({ params, query, request }) => {
			const identity = await resolveIdentity(request, "unit:read");
			await identity.authorization.unit.ensureCanRead(params.unitId, () => new UnitNotFound());
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			return database.transaction(async (tx) => {
				const [dock] = await tx
					.select({ id: unitDock.id })
					.from(unitDock)
					.where(and(eq(unitDock.unitId, params.unitId), eq(unitDock.kind, params.kind)))
					.limit(1);
				if (!dock) throw new DockNotFound();
				return { items: await listDockRevisions(tx, dock.id, query.limit ?? 50) };
			});
		},
		{
			params: DockParams,
			query: DockRevisionListQuery,
			response: {
				[StatusCodes.OK]: DockRevisionListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: { summary: "List Dock revisions", tags: ["Docks"] },
		},
	)
	.post(
		"/:unitId/docks/:kind/revisions/:revisionId/restore",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["dock", params.kind]]);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			return database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
				);
				const [dock] = await tx
					.select({ id: unitDock.id })
					.from(unitDock)
					.where(and(eq(unitDock.unitId, params.unitId), eq(unitDock.kind, params.kind)))
					.limit(1);
				if (!dock) throw new DockNotFound();
				const revision = await restoreDockRevision(tx, {
					dockId: dock.id,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					validateDocument: async (document) => {
						ensureDocument(document);
						await ensureResolvedDockReferences(tx, {
							document,
							owner,
							profileId: profile.unitId,
						});
					},
				});
				return { updated: true as const, latestRevisionId: revision.revisionId };
			});
		},
		{
			access: "contribute:unit:update",
			params: DockRevisionParams,
			body: DockRevisionBody,
			response: {
				[StatusCodes.OK]: DockMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported", "DockDocumentInvalid"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["DockRevisionConflict"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: { summary: "Restore a Dock revision", tags: ["Docks"] },
		},
	)
	.delete(
		"/:unitId/docks/:kind",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensureCanUpdate(params.unitId, [["dock", params.kind]]);
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			await database.transaction(async (tx) => {
				await tx.execute(
					sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
				);
				const [current] = await tx
					.select({ id: unitDock.id })
					.from(unitDock)
					.where(
						and(
							eq(unitDock.unitId, params.unitId),
							eq(unitDock.kind, params.kind),
							isNull(unitDock.deletedAt),
						),
					)
					.limit(1);
				if (!current) throw new DockNotFound();
				await lockDockHistory(tx, current.id);
				const [deleted] = await tx
					.update(unitDock)
					.set({ deletedAt: new Date(), updatedAt: new Date() })
					.where(and(eq(unitDock.id, current.id), isNull(unitDock.deletedAt)))
					.returning({ id: unitDock.id });
				if (!deleted) throw new DockNotFound();
				await deleteDockHistory(tx, {
					dockId: deleted.id,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "contribute:unit:update",
			params: DockParams,
			body: DockRevisionBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse(["DockRevisionConflict"]),
			},
			detail: {
				summary: "Delete a Unit Dock",
				tags: ["Docks"],
				responses: NoContentResponse,
			},
		},
	);
