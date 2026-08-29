import { StatusCodes } from "http-status-codes";
import { and, desc, eq, exists, lt, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import Elysia, { t, type Static } from "elysia";

import { recordAuditEvent } from "../../audit";
import session, { resolveIdentity } from "../../auth/session";
import { database, type DatabaseExecutor } from "../../database";
import { runVoteTransaction } from "../../database/vote-admission";
import { firstUnitLocalizationTitle } from "../../units/localization";
import {
	revisionContent,
	profile as profileTable,
	unit,
	unitRevision,
	unitRevisionCreditAttribution,
	unitRevisionHead,
	unitRevisionSlot,
	unitRevisionTag,
} from "../../database/schema";
import { createGovernanceDecision } from "../../governance/decision-service";
import { parseJsonCursor } from "../../pagination";
import { getUnitReadCondition } from "../../authorization/unit/query";
import {
	canViewRestrictedRevisionFields,
	canViewRevisionField,
	createRevisionVisibility,
	requiredRevisionVisibilityCapability,
	revisionVisibilitiesEqual,
	revisionVisibilityFromStorage,
	revisionVisibilityToStorage,
} from "../../history/visibility";
import {
	getUnitRevisionSlotContent,
	getUnitRevisionDocuments,
	lockUnitHistory,
	parseUnitRevisionSlotIdentity,
	restoreUnitRevision,
	undoUnitRevision,
	UnitRevisionChangeTags,
	unitRevisionDocumentsToComparisonValue,
} from "../../units/history";
import { presentStoredRevisionPrimaryContribution } from "../../units/revision-contribution";
import { toApiErrorResponse, VoteBackpressureResponse } from "../schema/response";
import { DevelopmentPreviewCapability } from "@rezics/access";
import { listCurrentProfileContributionResources } from "../../history/contribution-resources";
import {
	CurrentRevisionContentVisibilityForbidden,
	InvalidHistoryCursor,
	UnitRevisionNotFound,
} from "./errors";
import {
	ChangeTagListResponse,
	ContributionResourceListQuery,
	ContributionResourceListResponse,
	RevisionActionBody,
	RevisionActionResponse,
	RevisionContributionParams,
	RevisionFeedQuery,
	RevisionVisibilityBody,
	UnitHistoryParams,
	UnitHistoryQuery,
	UnitHistoryResponse,
	UnitScopedHistoryResponse,
	UnitRevisionActionParams,
	UnitRevisionCompareQuery,
	UnitRevisionCompareResponse,
	UnitRevisionParams,
	UnitRevisionResponse,
} from "./schema";

const RevisionCursor = t.Object(
	{
		v: t.Literal(1),
		scope: t.String(),
		createdAt: t.String({ format: "date-time" }),
		id: t.String({ format: "uuid" }),
	},
	{ additionalProperties: false },
);

function decodeCursor(value: string | undefined, scope: string) {
	if (!value) return undefined;
	try {
		const cursor = parseJsonCursor(value, RevisionCursor);
		if (cursor.scope !== scope) throw new InvalidHistoryCursor();
		return { createdAt: new Date(cursor.createdAt), id: cursor.id };
	} catch {
		throw new InvalidHistoryCursor();
	}
}

function encodeCursor(scope: string, createdAt: Date, id: string) {
	return Buffer.from(
		JSON.stringify({ v: 1, scope, createdAt: createdAt.toISOString(), id }),
	).toString("base64url");
}

const parentRevision = alias(unitRevision, "parent_revision");
const revisionTags = sql<string[]>`coalesce((
	select array_agg(tag order by tag)
	from unit_revision_tag
	where revision_id = ${unitRevision.id}
), array[]::text[])`;

const summarySelection = {
	id: unitRevision.id,
	unitId: unitRevision.unitId,
	parentRevisionId: unitRevision.parentRevisionId,
	actorProfileId: unitRevision.actorProfileId,
	primaryContributionKind: unitRevision.primaryContributionKind,
	creditedEntityId: unitRevisionCreditAttribution.creditedEntityId,
	creditRole: unitRevisionCreditAttribution.role,
	attributionAssurance: unitRevisionCreditAttribution.assurance,
	actorName: firstUnitLocalizationTitle(profileTable.id),
	editSummary: unitRevision.editSummary,
	minor: unitRevision.minor,
	byteSize: unitRevision.byteSize,
	sizeDelta: sql<number>`${unitRevision.byteSize} - coalesce(${parentRevision.byteSize}, 0)`,
	parentContentHidden: parentRevision.contentHidden,
	parentSuppressed: parentRevision.suppressed,
	contentHidden: unitRevision.contentHidden,
	summaryHidden: unitRevision.summaryHidden,
	actorHidden: unitRevision.actorHidden,
	suppressed: unitRevision.suppressed,
	createdAt: unitRevision.createdAt,
	tags: revisionTags,
	currentRevisionId: unitRevisionHead.revisionId,
};

type SummaryRow = Awaited<ReturnType<typeof selectSummaries>>[number];

function selectSummaries(executor: DatabaseExecutor = database) {
	return executor
		.select(summarySelection)
		.from(unitRevision)
		.leftJoin(
			unitRevisionCreditAttribution,
			eq(unitRevisionCreditAttribution.revisionId, unitRevision.id),
		)
		.leftJoin(parentRevision, eq(parentRevision.id, unitRevision.parentRevisionId))
		.leftJoin(profileTable, eq(profileTable.id, unitRevision.actorProfileId))
		.leftJoin(unitRevisionHead, eq(unitRevisionHead.unitId, unitRevision.unitId));
}

async function getVisibilityAccess(
	authorization: Awaited<ReturnType<typeof resolveIdentity>>["authorization"],
) {
	const [moderate, suppress] = await Promise.all([
		authorization.platform.hasCapability("platform.moderate"),
		authorization.platform.hasCapability("platform.suppress"),
	]);
	return { moderate, suppress };
}

function presentSummary(row: SummaryRow, access: { moderate: boolean; suppress: boolean }) {
	const visibility = revisionVisibilityFromStorage(row);
	const canSeeRestrictedFields = canViewRestrictedRevisionFields(visibility, access);
	return {
		id: row.id,
		unitId: row.unitId,
		parentRevisionId: row.parentRevisionId,
		actorProfileId: row.actorHidden && !canSeeRestrictedFields ? null : row.actorProfileId,
		actorName: row.actorHidden && !canSeeRestrictedFields ? null : row.actorName,
		primaryContribution: presentStoredRevisionPrimaryContribution({
			kind: row.primaryContributionKind,
			creditedEntityId: row.creditedEntityId,
			role: row.creditRole,
			assurance: row.attributionAssurance,
		}),
		editSummary: row.summaryHidden && !canSeeRestrictedFields ? null : row.editSummary,
		minor: row.minor,
		byteSize: row.byteSize,
		sizeDelta: row.sizeDelta,
		createdAt: row.createdAt,
		tags: row.tags,
		visibility,
		contentAvailable: canViewRevisionField(visibility, "content", access),
		parentContentAvailable:
			row.parentRevisionId === null ||
			!row.parentContentHidden ||
			(row.parentSuppressed ? access.suppress : access.moderate),
		isCurrent: row.currentRevisionId === row.id,
	};
}

async function findSummary(revisionId: string, executor: DatabaseExecutor = database) {
	const [row] = await selectSummaries(executor).where(eq(unitRevision.id, revisionId)).limit(1);
	if (!row) throw new UnitRevisionNotFound();
	return row;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return value !== null && typeof value === "object" && !Array.isArray(value);
}

type RevisionChange = { path: string; before: unknown; after: unknown };

function collectChanges(before: unknown, after: unknown, path = ""): RevisionChange[] {
	if (JSON.stringify(before) === JSON.stringify(after)) return [];
	if (!isRecord(before) || !isRecord(after)) return [{ path: path || "/", before, after }];
	const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
	return [...keys].flatMap((key) =>
		collectChanges(
			before[key],
			after[key],
			`${path}/${key.replaceAll("~", "~0").replaceAll("/", "~1")}`,
		),
	);
}

function cursorCondition(cursor: ReturnType<typeof decodeCursor>) {
	return cursor
		? or(
				lt(unitRevision.createdAt, cursor.createdAt),
				and(eq(unitRevision.createdAt, cursor.createdAt), lt(unitRevision.id, cursor.id)),
			)
		: undefined;
}

function revisionTagCondition(tag: string | undefined) {
	return tag
		? exists(
				database
					.select({ id: unitRevisionTag.revisionId })
					.from(unitRevisionTag)
					.where(
						and(eq(unitRevisionTag.revisionId, unitRevision.id), eq(unitRevisionTag.tag, tag)),
					),
			)
		: undefined;
}

export default new Elysia({ prefix: "/history" })
	.use(session)
	.get(
		"/contribution-resources/me",
		async ({ authorization, profile, query }) => {
			if (query.section === "zone")
				await authorization.platform.ensureCapability(DevelopmentPreviewCapability);
			return listCurrentProfileContributionResources({
				profileId: profile.unitId,
				query,
			});
		},
		{
			access: "profile:read",
			query: ContributionResourceListQuery,
			response: {
				[StatusCodes.OK]: ContributionResourceListResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidPaginationCursor"]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
			},
			detail: {
				operationId: "listCurrentUserContributionResources",
				summary: "List public resources the current user has created or contributed to",
				tags: ["History"],
			},
		},
	)
	.get(
		"/units/:unitId/revisions",
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			const [access, restoreDecision] = await Promise.all([
				getVisibilityAccess(authorization),
				authorization.unit.decide(params.unitId, "unit.history.restore"),
			]);
			const canRestore = restoreDecision.allowed;
			const scope = `unit:${params.unitId}`;
			const cursor = decodeCursor(query.cursor, scope);
			const limit = query.limit ?? 30;
			const rows = await selectSummaries()
				.where(and(eq(unitRevision.unitId, params.unitId), cursorCondition(cursor)))
				.orderBy(desc(unitRevision.createdAt), desc(unitRevision.id))
				.limit(limit + 1);
			const items = rows.slice(0, limit);
			const last = items.at(-1);
			return {
				items: items.map((row) => presentSummary(row, access)),
				capabilities: {
					canRestore,
					canModerate: access.moderate,
					canSuppress: access.suppress,
				},
				nextCursor:
					rows.length > limit && last ? encodeCursor(scope, last.createdAt, last.id) : null,
			};
		},
		{
			params: UnitHistoryParams,
			query: UnitHistoryQuery,
			response: {
				[StatusCodes.OK]: UnitScopedHistoryResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidHistoryCursor"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound"]),
			},
			detail: { summary: "List Unit revisions", tags: ["History"] },
		},
	)
	.get(
		"/unit-revisions/:revisionId",
		async ({ params, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			const row = await findSummary(params.revisionId);
			await authorization.unit.ensureCanRead(row.unitId);
			const access = await getVisibilityAccess(authorization);
			const canSeeContent = canViewRevisionField(
				revisionVisibilityFromStorage(row),
				"content",
				access,
			);
			if (!canSeeContent)
				return {
					...presentSummary(row, access),
					slots: [],
				} satisfies Static<typeof UnitRevisionResponse>;
			const { slots, documents } = await database.transaction(async (tx) => ({
				slots: await tx
					.select({
						role: unitRevisionSlot.role,
						slotKey: unitRevisionSlot.slotKey,
						model: revisionContent.model,
						originRevisionId: unitRevisionSlot.originRevisionId,
					})
					.from(unitRevisionSlot)
					.innerJoin(revisionContent, eq(revisionContent.id, unitRevisionSlot.contentId))
					.where(eq(unitRevisionSlot.revisionId, row.id))
					.orderBy(unitRevisionSlot.role, unitRevisionSlot.slotKey),
				documents: await getUnitRevisionDocuments(tx, row.id),
			}));
			return {
				...presentSummary(row, access),
				slots: slots.map((slot) => {
					const identity = parseUnitRevisionSlotIdentity(slot);
					const content = getUnitRevisionSlotContent(documents, identity);
					return identity.role === "localization"
						? {
								role: identity.role,
								language: identity.slotKey,
								model: slot.model,
								originRevisionId: slot.originRevisionId,
								content,
							}
						: {
								role: identity.role,
								model: slot.model,
								originRevisionId: slot.originRevisionId,
								content,
							};
				}),
			} satisfies Static<typeof UnitRevisionResponse>;
		},
		{
			params: UnitRevisionParams,
			response: {
				[StatusCodes.OK]: UnitRevisionResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "UnitRevisionNotFound"]),
			},
			detail: { summary: "Get Unit revision", tags: ["History"] },
		},
	)
	.get(
		"/units/:unitId/compare",
		async ({ params, query, request }) => {
			const { authorization } = await resolveIdentity(request, "unit:read");
			await authorization.unit.ensureCanRead(params.unitId);
			const access = await getVisibilityAccess(authorization);
			const [from, to] = await Promise.all([findSummary(query.from), findSummary(query.to)]);
			if (from.unitId !== params.unitId || to.unitId !== params.unitId)
				throw new UnitRevisionNotFound();
			if (
				!canViewRevisionField(revisionVisibilityFromStorage(from), "content", access) ||
				!canViewRevisionField(revisionVisibilityFromStorage(to), "content", access)
			)
				throw new UnitRevisionNotFound();
			const [fromDocuments, toDocuments] = await database.transaction(async (tx) => [
				await getUnitRevisionDocuments(tx, from.id),
				await getUnitRevisionDocuments(tx, to.id),
			]);
			return {
				fromRevisionId: from.id,
				toRevisionId: to.id,
				changes: collectChanges(
					unitRevisionDocumentsToComparisonValue(fromDocuments),
					unitRevisionDocumentsToComparisonValue(toDocuments),
				),
			};
		},
		{
			params: UnitHistoryParams,
			query: UnitRevisionCompareQuery,
			response: {
				[StatusCodes.OK]: UnitRevisionCompareResponse,
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitNotFound", "UnitRevisionNotFound"]),
			},
			detail: { summary: "Compare Unit revisions", tags: ["History"] },
		},
	)
	.post(
		"/units/:unitId/revisions/:revisionId/restore",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensure(params.unitId, "unit.history.restore");
			const source = await findSummary(params.revisionId);
			if (source.unitId !== params.unitId) throw new UnitRevisionNotFound();
			const access = await getVisibilityAccess(authorization);
			if (!canViewRevisionField(revisionVisibilityFromStorage(source), "content", access))
				throw new UnitRevisionNotFound();
			const result = await runVoteTransaction({ family: "unit_tag", authority: "global" }, (tx) =>
				restoreUnitRevision(tx, {
					unitId: params.unitId,
					sourceRevisionId: params.revisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					message: body.editSummary,
					minor: body.minor,
					authorization,
				}),
			);
			return { unitId: params.unitId, ...result };
		},
		{
			access: "write:unit:update",
			params: UnitRevisionActionParams,
			body: RevisionActionBody,
			response: {
				[StatusCodes.OK]: RevisionActionResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"EntityAssociationRestricted",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitRevisionNotFound",
					"EntityEntryNotFound",
					"ImageAssetNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
				[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
			},
			detail: { summary: "Restore Unit revision", tags: ["History"] },
		},
	)
	.post(
		"/units/:unitId/revisions/:revisionId/undo",
		async ({ params, body, profile, authorization }) => {
			await authorization.unit.ensure(params.unitId, "unit.history.restore");
			const target = await findSummary(params.revisionId);
			if (target.unitId !== params.unitId) throw new UnitRevisionNotFound();
			const access = await getVisibilityAccess(authorization);
			if (!canViewRevisionField(revisionVisibilityFromStorage(target), "content", access))
				throw new UnitRevisionNotFound();
			if (target.parentRevisionId) {
				const parent = await findSummary(target.parentRevisionId);
				if (!canViewRevisionField(revisionVisibilityFromStorage(parent), "content", access))
					throw new UnitRevisionNotFound();
			}
			const result = await runVoteTransaction({ family: "unit_tag", authority: "global" }, (tx) =>
				undoUnitRevision(tx, {
					unitId: params.unitId,
					targetRevisionId: params.revisionId,
					baseRevisionId: body.baseRevisionId,
					actorProfileId: profile.unitId,
					contribution: body.revisionContext?.contribution,
					message: body.editSummary,
					minor: body.minor,
					authorization,
				}),
			);
			return { unitId: params.unitId, ...result };
		},
		{
			access: "write:unit:update",
			params: UnitRevisionActionParams,
			body: RevisionActionBody,
			response: {
				[StatusCodes.OK]: RevisionActionResponse,
				[StatusCodes.CONFLICT]: toApiErrorResponse(["UnitRevisionConflict"]),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse([
					"RevisionCreditEntityInvalid",
					"RevisionContributionActorRequired",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse([
					"UnitPermissionForbidden",
					"EntityAssociationRestricted",
					"PlatformCapabilityRequired",
				]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse([
					"UnitNotFound",
					"UnitRevisionNotFound",
					"EntityEntryNotFound",
					"ImageAssetNotFound",
				]),
				[StatusCodes.UNPROCESSABLE_ENTITY]: toApiErrorResponse(["InvalidTagPath"]),
				[StatusCodes.TOO_MANY_REQUESTS]: VoteBackpressureResponse,
			},
			detail: { summary: "Undo Unit revision", tags: ["History"] },
		},
	)
	.patch(
		"/unit-revisions/:revisionId/visibility",
		async ({ params, body, profile, authorization }) => {
			const initial = await findSummary(params.revisionId);
			const requestedVisibility = createRevisionVisibility(
				body.visibility.kind,
				body.visibility.kind === "visible" ? [] : body.visibility.hiddenFields,
			);
			await database.transaction(async (tx) => {
				await lockUnitHistory(tx, initial.unitId);
				const current = await findSummary(params.revisionId, tx);
				const currentVisibility = revisionVisibilityFromStorage(current);
				const storedVisibility = revisionVisibilityToStorage(requestedVisibility);
				if (storedVisibility.contentHidden && current.currentRevisionId === current.id)
					throw new CurrentRevisionContentVisibilityForbidden();
				await authorization.platform.ensureCapability(
					requiredRevisionVisibilityCapability(currentVisibility, requestedVisibility),
					tx,
				);
				if (revisionVisibilitiesEqual(currentVisibility, requestedVisibility)) return;
				const decision = await createGovernanceDecision(tx, {
					action:
						body.visibility.kind === "visible"
							? "revision.visibility.restore"
							: "revision.visibility.restrict",
					actorProfileId: profile.unitId,
					authority: { kind: "unit", unitId: current.unitId },
					targetUnitId: current.unitId,
					subject: { kind: "unit_revision", id: current.id },
					basis: { kind: "rules", rules: body.rules },
				});
				await tx
					.update(unitRevision)
					.set(storedVisibility)
					.where(eq(unitRevision.id, params.revisionId));
				await recordAuditEvent(tx, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: { kind: "profile", profileId: profile.unitId },
					authority: { kind: "unit", id: current.unitId },
					action: "revision.visibility.update",
					governanceDecisionId: decision.id,
					target: { kind: "unit_revision", id: params.revisionId },
					details: {
						previousVisibility: currentVisibility,
						nextVisibility: requestedVisibility,
					},
				});
			});
			return new Response(null, { status: StatusCodes.NO_CONTENT });
		},
		{
			access: "unit:read",
			params: UnitRevisionParams,
			body: RevisionVisibilityBody,
			response: {
				[StatusCodes.NO_CONTENT]: t.Void(),
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["GovernanceRuleSourceForbidden"]),
				[StatusCodes.CONFLICT]: toApiErrorResponse([
					"CurrentRevisionContentVisibilityForbidden",
					"GovernanceRuleChanged",
				]),
				[StatusCodes.FORBIDDEN]: toApiErrorResponse(["PlatformCapabilityRequired"]),
				[StatusCodes.NOT_FOUND]: toApiErrorResponse(["UnitRevisionNotFound"]),
			},
			detail: { summary: "Update revision visibility", tags: ["History"] },
		},
	)
	.get(
		"/recent-changes",
		async ({ query, request }) => {
			const { profile, authorization } = await resolveIdentity(request, "unit:read");
			const access = await getVisibilityAccess(authorization);
			const scope = `recent:${query.tag ?? ""}:${query.minor ?? ""}`;
			const cursor = decodeCursor(query.cursor, scope);
			const limit = query.limit ?? 30;
			const rows = await selectSummaries()
				.innerJoin(unit, eq(unit.id, unitRevision.unitId))
				.where(
					and(
						getUnitReadCondition(profile?.unitId),
						cursorCondition(cursor),
						query.minor === undefined ? undefined : eq(unitRevision.minor, query.minor),
						revisionTagCondition(query.tag),
					),
				)
				.orderBy(desc(unitRevision.createdAt), desc(unitRevision.id))
				.limit(limit + 1);
			const items = rows.slice(0, limit);
			const last = items.at(-1);
			return {
				items: items.map((row) => presentSummary(row, access)),
				nextCursor:
					rows.length > limit && last ? encodeCursor(scope, last.createdAt, last.id) : null,
			};
		},
		{
			query: RevisionFeedQuery,
			response: {
				[StatusCodes.OK]: UnitHistoryResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidHistoryCursor"]),
			},
			detail: { summary: "List recent changes", tags: ["History"] },
		},
	)
	.get(
		"/contributions/:profileId",
		async ({ params, query, request }) => {
			const { profile, authorization } = await resolveIdentity(request, "unit:read");
			const access = await getVisibilityAccess(authorization);
			const scope = `contributions:${params.profileId}:${query.tag ?? ""}:${query.minor ?? ""}`;
			const cursor = decodeCursor(query.cursor, scope);
			const limit = query.limit ?? 30;
			const rows = await selectSummaries()
				.innerJoin(unit, eq(unit.id, unitRevision.unitId))
				.where(
					and(
						eq(unitRevision.actorProfileId, params.profileId),
						getUnitReadCondition(profile?.unitId),
						cursorCondition(cursor),
						query.minor === undefined ? undefined : eq(unitRevision.minor, query.minor),
						revisionTagCondition(query.tag),
						or(
							eq(unitRevision.actorHidden, false),
							and(eq(unitRevision.suppressed, false), sql`${access.moderate}`),
							sql`${access.suppress}`,
						),
					),
				)
				.orderBy(desc(unitRevision.createdAt), desc(unitRevision.id))
				.limit(limit + 1);
			const items = rows.slice(0, limit);
			const last = items.at(-1);
			return {
				items: items.map((row) => presentSummary(row, access)),
				nextCursor:
					rows.length > limit && last ? encodeCursor(scope, last.createdAt, last.id) : null,
			};
		},
		{
			params: RevisionContributionParams,
			query: RevisionFeedQuery,
			response: {
				[StatusCodes.OK]: UnitHistoryResponse,
				[StatusCodes.BAD_REQUEST]: toApiErrorResponse(["InvalidHistoryCursor"]),
			},
			detail: { summary: "List profile contributions", tags: ["History"] },
		},
	)
	.get("/change-tags", () => ({ items: UnitRevisionChangeTags.map((tag) => ({ tag })) }), {
		response: { [StatusCodes.OK]: ChangeTagListResponse },
		detail: { summary: "List revision change tags", tags: ["History"] },
	});
