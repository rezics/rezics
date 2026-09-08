import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";
import {
	PublishingDetailsSchema,
	PublishingEditSchema,
	PublishingMutationSchema,
	PublishingChildKindSchema,
	PublishingChildSchema,
	PublishingChildPutSchema,
	PublishingChildRemoveSchema,
	PublishingChildrenQuerySchema,
	PublishingHistoryComponentSchema,
	PublishingHistorySchema,
	PublishingRestoreSchema,
	PublishingPageQuerySchema,
	PublishingConnectionsQuerySchema,
	PublishingConnectionSchema,
	publishingPage,
} from "../../catalog/publishing-api-contracts";
import {
	readPublishingApiDetails,
	editPublishingApiDetails,
	pagePublishingApiChildren,
	putPublishingApiChild,
	removePublishingApiChild,
	pagePublishingApiHistory,
	restorePublishingApiHistory,
	pagePublishingApiConnections,
} from "../../catalog/publishing-api";
const params = z.strictObject({ id: z.uuid() }),
	children = params.extend({ kind: PublishingChildKindSchema }),
	child = children.extend({ componentId: z.uuid() }),
	history = params.extend({ component: PublishingHistoryComponentSchema, componentKey: z.uuid() });
const detail = (operationId: string, summary: string) => ({
	operationId,
	summary,
	tags: ["Catalog Publishing"],
});
/** @alpha @remarks Work, text version, publication and serialization remain independent native resources with exact child history. */
export default new Elysia({ prefix: "/publishing", name: "catalog-publishing-api" })
	.use(session)
	.get(
		"/:id/details",
		{
			params,
			response: PublishingDetailsSchema,
			detail: detail(
				"readPublishingDetails",
				"Read a work, text version, publication or serialization",
			),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readPublishingApiDetails(tx, params.id, actor)),
	)
	.put(
		"/:id/details",
		{
			access: "contribute:unit:update",
			params,
			body: PublishingEditSchema,
			response: PublishingMutationSchema,
			detail: detail("revisePublishingDetails", "Revise exact native Publishing fields"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				editPublishingApiDetails(tx, params.id, actor, body),
			),
	)
	.get(
		"/:id/components/:kind",
		{
			params: children,
			query: PublishingChildrenQuerySchema,
			response: publishingPage(PublishingChildSchema),
			detail: detail(
				"listPublishingComponents",
				"Read ordered coverage, publication events, facets or serial installments",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) =>
				pagePublishingApiChildren(tx, params.id, actor, params.kind, query),
			),
	)
	.put(
		"/:id/components/:kind/:componentId",
		{
			access: "contribute:unit:update",
			params: child,
			body: PublishingChildPutSchema,
			response: PublishingMutationSchema,
			detail: detail("putPublishingComponent", "Add or revise one exact Publishing child"),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				putPublishingApiChild(tx, params.id, actor, params.kind, params.componentId, body),
			),
	)
	.delete(
		"/:id/components/:kind/:componentId",
		{
			access: "contribute:unit:update",
			params: child,
			body: PublishingChildRemoveSchema,
			response: PublishingMutationSchema,
			detail: detail(
				"removePublishingComponent",
				"Remove one Publishing child while retaining its history",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				removePublishingApiChild(tx, params.id, actor, params.kind, params.componentId, body),
			),
	)
	.get(
		"/:id/history/:component/:componentKey",
		{
			params: history,
			query: PublishingPageQuerySchema,
			response: publishingPage(PublishingHistorySchema),
			detail: detail(
				"listPublishingComponentHistory",
				"Read authorized exact Publishing revision history",
			),
		},
		({ params, query, request }) =>
			catalogDomainHistory(request, { owner: "publishing", id: params.id }, (tx, actor) =>
				pagePublishingApiHistory(
					tx,
					params.id,
					actor,
					params.component,
					params.componentKey,
					query,
				),
			),
	)
	.post(
		"/:id/history/:component/:componentKey/restore",
		{
			access: "contribute:unit:update",
			params: history,
			body: PublishingRestoreSchema,
			response: PublishingMutationSchema,
			detail: detail(
				"restorePublishingComponent",
				"Restore Publishing state against its exact current child history",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				restorePublishingApiHistory(
					tx,
					params.id,
					actor,
					params.component,
					params.componentKey,
					body,
				),
			),
	)
	.get(
		"/:id/connections",
		{
			params,
			query: PublishingConnectionsQuerySchema,
			response: publishingPage(PublishingConnectionSchema),
			detail: detail(
				"listPublishingConnections",
				"Browse readable works, text versions, publications and serializations",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) =>
				pagePublishingApiConnections(tx, params.id, actor, query),
			),
	);
