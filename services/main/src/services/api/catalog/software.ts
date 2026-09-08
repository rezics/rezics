import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";
import {
	SoftwareDetailSchema,
	SoftwareDetailEditSchema,
	SoftwareMutationSchema,
	SoftwareDetailRestoreSchema,
	SoftwarePageQuerySchema,
	SoftwareDetailHistorySchema,
	softwarePage,
	SoftwareComponentKindSchema,
	SoftwareComponentKeySchema,
	SoftwareComponentSchema,
	SoftwareComponentPutSchema,
	SoftwareComponentRemoveSchema,
	SoftwareComponentRestoreSchema,
	SoftwareComponentMutationSchema,
	SoftwareComponentHistorySchema,
	SoftwareChildrenQuerySchema,
	SoftwareContextSchema,
	SoftwareContextCreateSchema,
	SoftwareContextEditSchema,
	SoftwareCreditSchema,
	SoftwareCreditCreateSchema,
	SoftwareCreditEditSchema,
	SoftwareChildHistorySchema,
	SoftwareChildRestoreSchema,
	SoftwareReleaseSearchSchema,
	SoftwareReleaseSummarySchema,
} from "../../catalog/software-api-contracts";
import {
	readSoftwareApiDetails,
	updateSoftwareApiDetails,
	pageSoftwareApiHistory,
	pageSoftwareApiComponents,
	pageSoftwareApiComponentHistory,
	pageSoftwareApiContexts,
	pageSoftwareApiCredits,
	pageSoftwareApiChildHistory,
	pageSoftwareApiReleases,
	presentSoftwareContext,
	presentSoftwareCredit,
} from "../../catalog/software-api";
import {
	restoreSoftwareDetails,
	readSoftwareHistory,
	readSoftwareComponentHistory,
} from "../../catalog/software";
import {
	putSoftwareComponent,
	withdrawSoftwareComponent,
	restoreSoftwareComponent,
} from "../../catalog/software-components";
import {
	createSoftwareParticipationContext,
	reviseSoftwareParticipationContext,
	readSoftwareParticipationContext,
	restoreSoftwareParticipationContext,
} from "../../catalog/software-contexts";
import {
	createSoftwareParticipation,
	reviseSoftwareParticipation,
	restoreSoftwareParticipation,
	readSoftwareParticipationHistory,
} from "../../catalog/software-participation";
import { CatalogReferenceNotFound, loadCatalogIdentity } from "../../catalog/storage";
import { SoftwareAnimationSchema } from "../../catalog/software-animation";
const params = z.strictObject({ id: z.uuid() }),
	collection = params.extend({ kind: SoftwareComponentKindSchema }),
	component = collection
		.extend({ componentId: SoftwareComponentKeySchema })
		.refine(
			(value) =>
				(value.kind === "animation" ? SoftwareAnimationSchema.shape.context : z.uuid()).safeParse(
					value.componentId,
				).success,
			{ path: ["componentId"], message: "Component key differs from its kind" },
		),
	context = params.extend({ contextId: z.uuid() }),
	credit = params.extend({ creditId: z.uuid() });
const reference = (id: string) => ({ owner: "software" as const, id });
const detail = (operationId: string, summary: string) => ({
	operationId,
	summary,
	tags: ["Catalog Software"],
});
/** @alpha @remarks Native software values, occurrences and exact credited roles; every mutation retains its owning revision fence. */
export default new Elysia({ prefix: "/software", name: "catalog-software-api" })
	.use(session)
	.get(
		"/:id/details",
		{
			params,
			response: SoftwareDetailSchema,
			detail: detail("readSoftwareDetails", "Read software content, version or release details"),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readSoftwareApiDetails(tx, params.id, actor)),
	)
	.put(
		"/:id/details",
		{
			access: "contribute:unit:update",
			params,
			body: SoftwareDetailEditSchema,
			response: SoftwareMutationSchema,
			detail: detail(
				"reviseSoftwareDetails",
				"Revise software details against the current owner revision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				updateSoftwareApiDetails(tx, params.id, actor, body),
			),
	)
	.get(
		"/:id/history",
		{
			params,
			query: SoftwarePageQuerySchema,
			response: softwarePage(SoftwareDetailHistorySchema),
			detail: detail("listSoftwareDetailsHistory", "Read authorized software detail history"),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, reference(params.id), (tx, actor) =>
				pageSoftwareApiHistory(tx, params.id, actor, query),
			),
	)
	.post(
		"/:id/history/restore",
		{
			access: "contribute:unit:update",
			params,
			body: SoftwareDetailRestoreSchema,
			response: SoftwareMutationSchema,
			detail: detail(
				"restoreSoftwareDetails",
				"Restore historical software details as a new revision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				const rows = await readSoftwareHistory(tx, reference(params.id), actor, {
					limit: 1,
					beforeRevision:
						body.historicalRevision < Number.MAX_SAFE_INTEGER
							? body.historicalRevision + 1
							: undefined,
				});
				if (rows[0]?.revision !== body.historicalRevision)
					throw new CatalogReferenceNotFound("Software history is unavailable");
				return restoreSoftwareDetails(
					tx,
					reference(params.id),
					actor,
					body.expectedRevision,
					body.historicalRevision,
				);
			}),
	)
	.get(
		"/:id/releases",
		{
			params,
			query: SoftwareReleaseSearchSchema,
			response: softwarePage(SoftwareReleaseSummarySchema),
			detail: detail(
				"findSoftwareReleases",
				"Find readable releases matching the same language, platform and medium",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageSoftwareApiReleases(tx, params.id, actor, query)),
	)
	.get(
		"/:id/components/:kind",
		{
			params: collection,
			query: SoftwarePageQuerySchema,
			response: softwarePage(SoftwareComponentSchema),
			detail: detail(
				"listSoftwareComponents",
				"List native release content, languages, carriers and animation",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) =>
				pageSoftwareApiComponents(tx, params.id, actor, params.kind, query),
			),
	)
	.put(
		"/:id/components/:kind/:componentId",
		{
			access: "contribute:unit:update",
			params: component,
			body: SoftwareComponentPutSchema,
			response: SoftwareComponentMutationSchema,
			detail: detail("putSoftwareComponent", "Add or revise an exact software release component"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				if (params.kind !== body.value.kind)
					throw new TypeError("Software component kind differs from its path");
				const result = await putSoftwareComponent(
					tx,
					reference(params.id),
					actor,
					body.expectedRevision,
					params.componentId,
					body.expectedComponentRevision,
					body.value,
				);
				return { revision: result.revision, componentRevision: result.componentRevision };
			}),
	)
	.delete(
		"/:id/components/:kind/:componentId",
		{
			access: "contribute:unit:update",
			params: component,
			body: SoftwareComponentRemoveSchema,
			response: SoftwareComponentMutationSchema,
			detail: detail("withdrawSoftwareComponent", "Withdraw one exact release component"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				const result = await withdrawSoftwareComponent(
					tx,
					reference(params.id),
					actor,
					body.expectedRevision,
					params.kind,
					params.componentId,
					body.expectedComponentRevision,
				);
				return { revision: result.revision, componentRevision: result.componentRevision };
			}),
	)
	.get(
		"/:id/components/:kind/:componentId/history",
		{
			params: component,
			query: SoftwarePageQuerySchema,
			response: softwarePage(SoftwareComponentHistorySchema),
			detail: detail("listSoftwareComponentHistory", "Read authorized release component revisions"),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, reference(params.id), (tx, actor) =>
				pageSoftwareApiComponentHistory(
					tx,
					params.id,
					actor,
					params.kind,
					params.componentId,
					query,
				),
			),
	)
	.post(
		"/:id/components/:kind/:componentId/restore",
		{
			access: "contribute:unit:update",
			params: component,
			body: SoftwareComponentRestoreSchema,
			response: SoftwareComponentMutationSchema,
			detail: detail(
				"restoreSoftwareComponent",
				"Restore a release component against its exact current revision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				if (params.kind !== "animation") {
					const rows = await readSoftwareComponentHistory(
						tx,
						reference(params.id),
						actor,
						params.kind,
						params.componentId,
						{
							limit: 1,
							beforeRevision:
								body.historicalRevision < Number.MAX_SAFE_INTEGER
									? body.historicalRevision + 1
									: undefined,
						},
					);
					if (rows[0]?.revision !== body.historicalRevision)
						throw new CatalogReferenceNotFound("Software component history is unavailable");
				}
				const result = await restoreSoftwareComponent(
					tx,
					reference(params.id),
					actor,
					body.expectedRevision,
					params.kind,
					params.componentId,
					body.expectedComponentRevision,
					body.historicalRevision,
				);
				return { revision: result.revision, componentRevision: result.componentRevision };
			}),
	)
	.get(
		"/:id/contexts",
		{
			params,
			query: SoftwareChildrenQuerySchema,
			response: softwarePage(SoftwareContextSchema),
			detail: detail("listSoftwareParticipationContexts", "List software credit contexts"),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageSoftwareApiContexts(tx, params.id, actor, query)),
	)
	.get(
		"/:id/contexts/:contextId",
		{
			params: context,
			response: SoftwareContextSchema,
			detail: detail("readSoftwareParticipationContext", "Read a software credit context"),
		},
		({ params, request }) =>
			catalogRead(request, async (tx, actor) => {
				const row = await readSoftwareParticipationContext(
					tx,
					reference(params.id),
					actor,
					params.contextId,
				);
				if (row.state === "withdrawn")
					await loadCatalogIdentity(tx, reference(params.id), actor, true);
				return presentSoftwareContext(row);
			}),
	)
	.post(
		"/:id/contexts",
		{
			access: "contribute:unit:update",
			params,
			body: SoftwareContextCreateSchema,
			response: SoftwareContextSchema,
			detail: detail("createSoftwareParticipationContext", "Create a software credit context"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentSoftwareContext(
					await createSoftwareParticipationContext(tx, reference(params.id), actor, body.value),
				),
			),
	)
	.put(
		"/:id/contexts/:contextId",
		{
			access: "contribute:unit:update",
			params: context,
			body: SoftwareContextEditSchema,
			response: SoftwareContextSchema,
			detail: detail("reviseSoftwareParticipationContext", "Revise one exact credit context"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentSoftwareContext(
					await reviseSoftwareParticipationContext(
						tx,
						reference(params.id),
						actor,
						params.contextId,
						body.expectedRevision,
						body.value,
					),
				),
			),
	)
	.get(
		"/:id/contexts/:contextId/history",
		{
			params: context,
			query: SoftwarePageQuerySchema,
			response: softwarePage(SoftwareChildHistorySchema),
			detail: detail(
				"listSoftwareParticipationContextHistory",
				"Read authorized credit context history",
			),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, reference(params.id), (tx, actor) =>
				pageSoftwareApiChildHistory(tx, params.id, actor, "context", params.contextId, query),
			),
	)
	.post(
		"/:id/contexts/:contextId/restore",
		{
			access: "contribute:unit:update",
			params: context,
			body: SoftwareChildRestoreSchema,
			response: SoftwareContextSchema,
			detail: detail(
				"restoreSoftwareParticipationContext",
				"Restore a credit context as a new revision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentSoftwareContext(
					await restoreSoftwareParticipationContext(
						tx,
						reference(params.id),
						actor,
						params.contextId,
						body.expectedRevision,
						body.historicalRevision,
					),
				),
			),
	)
	.get(
		"/:id/credits",
		{
			params,
			query: SoftwareChildrenQuerySchema,
			response: softwarePage(SoftwareCreditSchema),
			detail: detail(
				"listSoftwareCredits",
				"List readable staff and voice credits with exact name and context references",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageSoftwareApiCredits(tx, params.id, actor, query)),
	)
	.post(
		"/:id/credits",
		{
			access: "contribute:unit:update",
			params,
			body: SoftwareCreditCreateSchema,
			response: SoftwareCreditSchema,
			detail: detail("createSoftwareCredit", "Create an exact staff or voice credit"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				const result = await createSoftwareParticipation(
					tx,
					reference(params.id),
					actor,
					body.value,
				);
				return SoftwareCreditSchema.parse({
					id: result.participationId,
					revision: result.revision,
					value: body.value,
				});
			}),
	)
	.put(
		"/:id/credits/:creditId",
		{
			access: "contribute:unit:update",
			params: credit,
			body: SoftwareCreditEditSchema,
			response: SoftwareCreditSchema,
			detail: detail(
				"reviseSoftwareCredit",
				"Revise a staff or voice credit against its exact revision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				const result = await reviseSoftwareParticipation(
					tx,
					reference(params.id),
					actor,
					params.creditId,
					body.expectedRevision,
					body.value,
				);
				return SoftwareCreditSchema.parse({
					id: result.participationId,
					revision: result.revision,
					value: body.value,
				});
			}),
	)
	.get(
		"/:id/credits/:creditId/history",
		{
			params: credit,
			query: SoftwarePageQuerySchema,
			response: softwarePage(SoftwareChildHistorySchema),
			detail: detail("listSoftwareCreditHistory", "Read authorized staff and voice credit history"),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, reference(params.id), (tx, actor) =>
				pageSoftwareApiChildHistory(tx, params.id, actor, "credit", params.creditId, query),
			),
	)
	.post(
		"/:id/credits/:creditId/restore",
		{
			access: "contribute:unit:update",
			params: credit,
			body: SoftwareChildRestoreSchema,
			response: SoftwareCreditSchema,
			detail: detail("restoreSoftwareCredit", "Restore an exact historical staff or voice credit"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, async (tx, actor) => {
				const result = await restoreSoftwareParticipation(
					tx,
					reference(params.id),
					actor,
					params.creditId,
					body.expectedRevision,
					body.historicalRevision,
				);
				const [row] = await readSoftwareParticipationHistory(
					tx,
					reference(params.id),
					actor,
					params.creditId,
					{ afterRevision: result.revision - 1, limit: 1 },
				);
				if (!row) throw new CatalogReferenceNotFound();
				return presentSoftwareCredit(row);
			}),
	);
