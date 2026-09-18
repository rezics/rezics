import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";
import { assignGroupingClass, removeGroupingClass, readGroupingClasses, createGroupingOrderProfile,
	readGroupingOrderProfiles, renameGroupingOrderProfile, orderGroupingRelation, removeGroupingOrderEntry,
	readGroupingOrder, readGroupingHistory, restoreGroupingCommand } from "../../catalog/grouping";
import { GroupingMutationSchema, GroupingEditSchema, GroupingClassSchema, GroupingOrderProfileSchema,
	GroupingOrderProfileEditSchema, GroupingOrderCreatedSchema, GroupingOrderEntrySchema, GroupingOrderEntryEditSchema,
	GroupingOrderCursorSchema, GroupingOrderQuerySchema, GroupingHistorySchema, GroupingRestoreSchema, groupingPage } from "../../catalog/grouping-api-contracts";
import { DomainPageQuerySchema, decodeDomainCursor, encodeDomainCursor, domainPage } from "../../catalog/domain-api-pagination";
import { CatalogRevisionNumberSchema } from "@rezics/schema/contracts/native/names";

const params = z.strictObject({ id: z.uuid() });
const classParams = params.extend({ classRevisionId: z.uuid() });
const profileParams = params.extend({ profileId: z.uuid() });
const entryParams = profileParams.extend({ relationId: z.uuid() });
const reference = (id: string) => ({ owner: "grouping" as const, id });
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["Catalog Grouping"] });

/** @alpha @remarks Classifications and independently named membership orders share the native owner's revision fence. */
export default new Elysia({ prefix: "/grouping", name: "catalog-grouping-api" }).use(session)
	.get("/:id/classes", { params, query: DomainPageQuerySchema, response: groupingPage(GroupingClassSchema),
		detail: detail("listGroupingClasses", "Read grouping classifications") }, ({ params, query, request }) =>
		catalogRead(request, async (tx, actor) => {
			const scope = `grouping:${params.id}:classes`;
			const rows = await readGroupingClasses(tx, reference(params.id), actor, { limit: query.limit, afterId: decodeDomainCursor(scope, query.cursor, z.uuid()) });
			return domainPage(scope, rows.map(row => ({ classRevisionId: row.classRevisionId })), query.limit, row => row.classRevisionId);
		}))
	.put("/:id/classes/:classRevisionId", { access: "contribute:unit:update", params: classParams, body: GroupingEditSchema, response: GroupingMutationSchema,
		detail: detail("assignGroupingClass", "Assign a governed grouping classification") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => assignGroupingClass(tx, reference(params.id), actor, body.expectedRevision, params.classRevisionId)))
	.delete("/:id/classes/:classRevisionId", { access: "contribute:unit:update", params: classParams, body: GroupingEditSchema, response: GroupingMutationSchema,
		detail: detail("removeGroupingClass", "Remove a classification without changing memberships") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => removeGroupingClass(tx, reference(params.id), actor, body.expectedRevision, params.classRevisionId)))
	.get("/:id/orders", { params, query: DomainPageQuerySchema, response: groupingPage(GroupingOrderProfileSchema),
		detail: detail("listGroupingOrderProfiles", "Read independently named membership orders") }, ({ params, query, request }) =>
		catalogRead(request, async (tx, actor) => {
			const scope = `grouping:${params.id}:orders`;
			const rows = await readGroupingOrderProfiles(tx, reference(params.id), actor, { limit: query.limit, afterId: decodeDomainCursor(scope, query.cursor, z.uuid()) });
			return domainPage(scope, rows.map(row => ({ id: row.id, key: row.key })), query.limit, row => row.id);
		}))
	.post("/:id/orders", { access: "contribute:unit:update", params, body: GroupingOrderProfileEditSchema, response: GroupingOrderCreatedSchema,
		detail: detail("createGroupingOrderProfile", "Create an independent membership order") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => createGroupingOrderProfile(tx, reference(params.id), actor, body.expectedRevision, body.key)))
	.put("/:id/orders/:profileId", { access: "contribute:unit:update", params: profileParams, body: GroupingOrderProfileEditSchema, response: GroupingMutationSchema,
		detail: detail("renameGroupingOrderProfile", "Rename an existing membership order") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => renameGroupingOrderProfile(tx, reference(params.id), actor, body.expectedRevision, params.profileId, body.key)))
	.get("/:id/orders/:profileId/entries", { params: profileParams, query: GroupingOrderQuerySchema, response: groupingPage(GroupingOrderEntrySchema),
		detail: detail("listGroupingOrderEntries", "Page current readable relations in one named order") }, ({ params, query, request }) =>
		catalogRead(request, async (tx, actor) => {
			const scope = `grouping:${params.id}:order:${params.profileId}:spoiler:${query.maxSpoiler}`;
			const page = await readGroupingOrder(tx, reference(params.id), actor, params.profileId, {
				limit: query.limit, maxSpoiler: query.maxSpoiler, after: decodeDomainCursor(scope, query.cursor, GroupingOrderCursorSchema),
			});
			return { items: page.items, nextCursor: page.after ? encodeDomainCursor(scope, page.after) : null };
		}))
	.put("/:id/orders/:profileId/entries/:relationId", { access: "contribute:unit:update", params: entryParams, body: GroupingOrderEntryEditSchema, response: GroupingMutationSchema,
		detail: detail("putGroupingOrderEntry", "Position one exact active relation in a membership order") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => orderGroupingRelation(tx, reference(params.id), actor, body.expectedRevision, {
			profileId: params.profileId, relationId: params.relationId, position: body.position, sourcePosition: body.sourcePosition,
		})))
	.delete("/:id/orders/:profileId/entries/:relationId", { access: "contribute:unit:update", params: entryParams, body: GroupingEditSchema, response: GroupingMutationSchema,
		detail: detail("removeGroupingOrderEntry", "Remove an order entry while retaining its underlying relation") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => removeGroupingOrderEntry(tx, reference(params.id), actor, body.expectedRevision, { profileId: params.profileId, relationId: params.relationId })))
	.get("/:id/history", { params, query: DomainPageQuerySchema, response: groupingPage(GroupingHistorySchema),
		detail: detail("listGroupingHistory", "Read authorized classification and order command history") }, ({ params, query, request }) =>
		catalogDomainHistory(request, reference(params.id), async (tx, actor) => {
			const scope = `grouping:${params.id}:history`;
			const rows = await readGroupingHistory(tx, reference(params.id), actor, { limit: query.limit, afterRevision: decodeDomainCursor(scope, query.cursor, CatalogRevisionNumberSchema) });
			return domainPage(scope, rows.map(row => ({ revision: row.revision, createdAt: row.createdAt.toISOString(), snapshot: row.snapshot })), query.limit, row => row.revision);
		}))
	.post("/:id/history/restore", { access: "contribute:unit:update", params, body: GroupingRestoreSchema, response: GroupingMutationSchema,
		detail: detail("restoreGroupingCommand", "Reapply one historical classification or order command") }, ({ params, body, participation }) =>
		catalogMutation(participation, (tx, actor) => restoreGroupingCommand(tx, reference(params.id), actor, body.expectedRevision, body.historicalRevision)));
