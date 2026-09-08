import { CatalogReferenceSchema } from "@rezics/reference";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import {
	CatalogAccessDenied,
	CatalogRevisionConflict,
	recordCatalogChange,
} from "../../catalog/storage";
import {
	runWithParticipationAuthority,
	ParticipationDenied,
	type ParticipationAuthority,
} from "../../participation/policy";
import {
	DockBlockHostPolicy,
	DockDocument,
	UnresolvedBlockReferenceError,
	assertBlockQueryBudget,
	assertDockDocument,
	assertResolvedBlockReferences,
	parseDocument,
} from "@rezics/block";
import { and, eq, getTableColumns, isNull, sql } from "drizzle-orm";
import Elysia, { t } from "elysia";
import { StatusCodes } from "http-status-codes";
import type { StaticDecode } from "typebox";

import session, { resolveIdentity } from "../../auth/session";
import {
	createUnitBlockReferenceResolver,
	unitBlockGraphLockName,
} from "../../blocks/reference-resolver";
import { database, type DatabaseTransaction } from "../../database";
import {
	dockRevisionHead,
	isDockKindSupported,
	isDockOwnerUnitKind,
	unitDock,
} from "../../database/schema";
import { assertExecutableBlockFilterDocuments } from "../../search/block-filter-documents";
import { UnitNotFound } from "../../units/errors";
import { readUnitStateById } from "../../units/query";
import { NoContentResponse } from "../schema/action-response";
import { toApiErrorResponse } from "../schema/response";
import {
	DockDocumentInvalid,
	DockNotFound,
	DockNotSupported,
	DockRevisionConflict,
} from "./errors";
import {
	createDockHistory,
	deleteDockHistory,
	getDockRevisionId,
	listDockRevisions,
	lockDockHistory,
	restoreDockRevision,
	updateDockHistory,
} from "./history";
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

const UnitNotFoundResponse = toApiErrorResponse(["UnitNotFound"]);
const UnitMutationForbiddenResponse = toApiErrorResponse([
	"UnitPermissionForbidden",
	"ParticipationDenied",
]);

async function getDockOwner(unitId: string) {
	const owner = await readUnitStateById(database, unitId);
	if (!owner) throw new UnitNotFound();
	if (!isDockOwnerUnitKind(owner.reference.owner)) throw new DockNotSupported();
	return {
		id: owner.id,
		kind: owner.reference.owner,
		revision: owner.revision,
	};
}

async function mutateDockOwner<T>(
	input: {
		readonly owner: Awaited<ReturnType<typeof getDockOwner>>;
		readonly kind: "main" | "wiki";
		readonly expectedOwnerRevision: number | undefined;
		readonly actorAuthUserId: string;
		readonly authorization: UnitAuthorization<string>;
		readonly participation: ParticipationAuthority;
	},
	work: (tx: DatabaseTransaction, ownerRevision: number) => Promise<T>,
): Promise<T> {
	return runWithParticipationAuthority(input.participation, () =>
		database.transaction(async (tx) => {
			const native = CatalogReferenceSchema.safeParse({
				owner: input.owner.kind,
				id: input.owner.id,
			});
			let ownerRevision = input.owner.revision;
			if (native.success) {
				if (input.expectedOwnerRevision === undefined)
					throw new CatalogRevisionConflict(
						"Native Dock writes require the current owner revision",
					);
				try {
					ownerRevision = await recordCatalogChange(
						tx,
						native.data,
						input.actorAuthUserId,
						input.expectedOwnerRevision,
						"dock." + input.kind + ".update",
					);
				} catch (error) {
					if (error instanceof CatalogAccessDenied) throw new ParticipationDenied();
					throw error;
				}
			} else {
				const decision = await input.authorization.decideInTransaction(
					tx,
					input.owner.id,
					"unit.update",
					[["dock", input.kind]],
				);
				if (!decision.allowed) throw new ParticipationDenied();
			}
			return work(tx, ownerRevision);
		}),
	);
}

function ensureSupported(owner: Awaited<ReturnType<typeof getDockOwner>>, kind: "main" | "wiki") {
	if (!isDockKindSupported(owner.kind, kind)) throw new DockNotSupported();
}

function ensureDocument(value: unknown): asserts value is StaticDecode<typeof DockDocument> {
	try {
		assertDockDocument(value);
		assertBlockQueryBudget(value, DockBlockHostPolicy);
		assertExecutableBlockFilterDocuments(value, true);
	} catch {
		throw new DockDocumentInvalid();
	}
}

function presentDock(
	record: typeof unitDock.$inferSelect,
	latestRevisionId: string,
	ownerRevision: number,
) {
	return {
		ownerRevision,
		id: record.id,
		unitId: record.unitId,
		kind: record.kind,
		latestRevisionId,
		document: parseDocument(DockDocument, record.document),
		createdAt: record.createdAt,
		updatedAt: record.updatedAt,
	} satisfies StaticDecode<typeof DockResponse>;
}

async function ensureResolvedDockReferences(
	tx: DatabaseTransaction,
	input: {
		readonly document: StaticDecode<typeof DockDocument>;
		readonly owner: Awaited<ReturnType<typeof getDockOwner>>;
		readonly profileId: string;
		readonly authorization: UnitAuthorization<string>;
	},
): Promise<void> {
	try {
		await assertResolvedBlockReferences(
			input.document,
			createUnitBlockReferenceResolver(tx, {
				host: { unitId: input.owner.id, kind: input.owner.kind },
				profileId: input.profileId,
				authorization: input.authorization,
			}),
		);
	} catch (cause) {
		if (cause instanceof UnresolvedBlockReferenceError) throw new DockDocumentInvalid();
		throw cause;
	}
}

export default new Elysia({ prefix: "/units/by-id" })
	.use(session)
	.get(
		"/:unitId/docks",
		{
			params: DockUnitParams,
			response: {
				[StatusCodes.OK]: DockListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
			},
			detail: { summary: "List configured Unit Docks", tags: ["Docks"] },
		},
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
					items.push(presentDock(dock, dock.latestRevisionId, owner.revision));
				}
				return { ownerRevision: owner.revision, items };
			});
		},
	)
	.get(
		"/:unitId/docks/:kind",
		{
			params: DockParams,
			response: {
				[StatusCodes.OK]: DockResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: { summary: "Get a Unit Dock", tags: ["Docks"] },
		},
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
			return presentDock(record, latestRevisionId, owner.revision);
		},
	)
	.put(
		"/:unitId/docks/:kind",
		{
			access: "contribute:unit:update",
			params: DockParams,
			body: PutDockBody,
			response: {
				[StatusCodes.OK]: DockResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported", "DockDocumentInvalid"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: UnitNotFoundResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"DockRevisionConflict",
					"CatalogRevisionConflict",
				]),
			},
			detail: { summary: "Create or replace a Unit Dock", tags: ["Docks"] },
		},
		async ({ params, body, entity, user, authorization, participation }) => {
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			ensureDocument(body.document);
			return mutateDockOwner(
				{
					owner,
					kind: params.kind,
					expectedOwnerRevision: body.expectedOwnerRevision,
					actorAuthUserId: user.id,
					authorization: authorization.unit,
					participation,
				},
				async (tx, ownerRevision) => {
					await tx.execute(
						sql`select pg_advisory_xact_lock(hashtextextended(${unitBlockGraphLockName({ unitId: owner.id, kind: owner.kind })}::text, 0))`,
					);
					await ensureResolvedDockReferences(tx, {
						document: body.document,
						owner,
						profileId: entity.id,
						authorization: authorization.unit,
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
							actorProfileId: entity.id,
						});
						return presentDock(saved, revision.revisionId, ownerRevision);
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
						actorProfileId: entity.id,
					});
					return presentDock(saved, revision.revisionId, ownerRevision);
				},
			);
		},
	)
	.get(
		"/:unitId/docks/:kind/revisions",
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
				return {
					items: await listDockRevisions(tx, dock.id, query.limit ?? 50),
				};
			});
		},
	)
	.post(
		"/:unitId/docks/:kind/revisions/:revisionId/restore",
		{
			access: "contribute:unit:update",
			params: DockRevisionParams,
			body: DockRevisionBody,
			response: {
				[StatusCodes.OK]: DockMutationResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported", "DockDocumentInvalid"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"DockRevisionConflict",
					"CatalogRevisionConflict",
				]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
			},
			detail: { summary: "Restore a Dock revision", tags: ["Docks"] },
		},
		async ({ params, body, entity, user, authorization, participation }) => {
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			return mutateDockOwner(
				{
					owner,
					kind: params.kind,
					expectedOwnerRevision: body.expectedOwnerRevision,
					actorAuthUserId: user.id,
					authorization: authorization.unit,
					participation,
				},
				async (tx, ownerRevision) => {
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
						actorProfileId: entity.id,
						validateDocument: async (document) => {
							ensureDocument(document);
							await ensureResolvedDockReferences(tx, {
								document,
								owner,
								profileId: entity.id,
								authorization: authorization.unit,
							});
						},
					});
					return {
						updated: true as const,
						latestRevisionId: revision.revisionId,
						ownerRevision,
					};
				},
			);
		},
	)
	.delete(
		"/:unitId/docks/:kind",
		{
			access: "contribute:unit:update",
			params: DockParams,
			body: DockRevisionBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["DockNotSupported"]),
				[StatusCodes.FORBIDDEN]: UnitMutationForbiddenResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "DockNotFound"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"DockRevisionConflict",
					"CatalogRevisionConflict",
				]),
			},
			detail: {
				summary: "Delete a Unit Dock",
				tags: ["Docks"],
				responses: NoContentResponse,
			},
		},
		async ({ params, body, entity, user, authorization, participation }) => {
			const owner = await getDockOwner(params.unitId);
			ensureSupported(owner, params.kind);
			await mutateDockOwner(
				{
					owner,
					kind: params.kind,
					expectedOwnerRevision: body.expectedOwnerRevision,
					actorAuthUserId: user.id,
					authorization: authorization.unit,
					participation,
				},
				async (tx, ownerRevision) => {
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
						actorProfileId: entity.id,
					});
				},
			);
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
	);
