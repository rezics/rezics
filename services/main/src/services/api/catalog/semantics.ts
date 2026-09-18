import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { CatalogOwnerValues } from "@rezics/schema/contracts/native/catalog";
import { readCatalogRelationQualifiers } from "../../catalog/storage";
import { transitionCatalogSemanticState, restoreCatalogSemanticRevision } from "../../catalog/semantic-history";
import {
	WriteCatalogFactSchema, WriteCatalogRelationSchema, CatalogSemanticCreatedSchema,
	CatalogSemanticMutationSchema, CatalogSemanticQuerySchema, CatalogNodeQuerySchema,
	CatalogFactSummarySchema, CatalogRelationSummarySchema, catalogSemanticPage,
	CatalogValuePageSchema, CatalogParticipantPageSchema, CatalogQualifierSchema,
	CatalogSemanticHistoryQuerySchema, CatalogSemanticHistorySchema,
	CatalogSemanticStateSchema, CatalogSemanticRestoreSchema,
} from "../../catalog/semantic-api-contracts";
import {
	writeCatalogApiFact, writeCatalogApiRelation, pageCatalogApiFacts, pageCatalogApiRelations,
	pageCatalogApiFactNodes, pageCatalogApiParticipants, pageCatalogApiSemanticHistory,
} from "../../catalog/semantic-api";
import { catalogMutation, catalogRead } from "./transaction";

const reference = z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() });
const fact = reference.extend({ factId: z.uuid() });
const relation = reference.extend({ relationId: z.uuid() });
const semantic = reference.extend({ semanticId: z.uuid() });
const qualifierQuery = CatalogSemanticQuerySchema.omit({ definitionRevisionId: true, includeInactive: true }).extend({
	limit: z.coerce.number().int().min(1).max(64).default(50),
});
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["Catalog semantics"] });

/** @alpha @remarks Edit typed attributes and role-bearing relations using their exact immutable meanings. */
export default new Elysia({ prefix: "/resources/:owner/:id", name: "catalog-semantics-api" })
	.use(session)
	.get("/facts", { params: reference, query: CatalogSemanticQuerySchema,
		response: catalogSemanticPage(CatalogFactSummarySchema), detail: detail("listCatalogFacts", "List current typed catalog attributes") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogApiFacts(tx, params, actor, query)))
	.post("/facts", { access: "contribute:unit:update", params: reference, body: WriteCatalogFactSchema,
		response: CatalogSemanticCreatedSchema, detail: detail("writeCatalogFact", "Write or replace one typed catalog attribute") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => writeCatalogApiFact(tx, params, actor, body)))
	.get("/facts/:factId/nodes", { params: fact, query: CatalogNodeQuerySchema,
		response: CatalogValuePageSchema, detail: detail("listCatalogFactNodes", "Read the exact typed value in bounded pages") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogApiFactNodes(tx, params, actor, params.factId, query)))
	.get("/relations", { params: reference, query: CatalogSemanticQuerySchema,
		response: catalogSemanticPage(CatalogRelationSummarySchema), detail: detail("listCatalogRelations", "List current catalog relations") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogApiRelations(tx, params, actor, query)))
	.post("/relations", { access: "contribute:unit:update", params: reference, body: WriteCatalogRelationSchema,
		response: CatalogSemanticCreatedSchema, detail: detail("writeCatalogRelation", "Write or replace one catalog relation with its participants") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => writeCatalogApiRelation(tx, params, actor, body)))
	.get("/relations/:relationId/participants", { params: relation, query: CatalogNodeQuerySchema,
		response: CatalogParticipantPageSchema, detail: detail("listCatalogRelationParticipants", "Read relation participants and their roles") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogApiParticipants(tx, params, actor, params.relationId, query)))
	.get("/relations/:relationId/qualifiers", { params: relation, query: qualifierQuery,
		response: catalogSemanticPage(CatalogQualifierSchema), detail: detail("listCatalogRelationQualifiers", "Read qualifiers of an exact relation") },
		({ params, query, request }) => catalogRead(request, async (tx, actor) => {
			const items = await readCatalogRelationQualifiers(tx, params, actor, params.relationId, query);
			return { items, afterId: items.length === query.limit ? (items.at(-1)?.id ?? null) : null };
		}))
	.get("/semantics/:semanticId/history", { params: semantic, query: CatalogSemanticHistoryQuerySchema,
		response: CatalogSemanticHistorySchema, detail: detail("listCatalogSemanticHistory", "Read the immutable decisions for a catalog attribute or relation") },
		({ params, query, request }) => catalogRead(request, (tx, actor) => pageCatalogApiSemanticHistory(tx, params, actor, params.semanticId, query)))
	.post("/semantics/:semanticId/state", { access: "contribute:unit:update", params: semantic, body: CatalogSemanticStateSchema,
		response: CatalogSemanticMutationSchema, detail: detail("transitionCatalogSemanticState", "Dispute, withdraw or supersede a catalog decision") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => transitionCatalogSemanticState(
			tx, params, actor, body.expectedRevision, params.semanticId, body.expectedHeadVersion, body.state)))
	.post("/semantics/:semanticId/restore", { access: "contribute:unit:update", params: semantic, body: CatalogSemanticRestoreSchema,
		response: CatalogSemanticMutationSchema, detail: detail("restoreCatalogSemanticRevision", "Restore an eligible historical value as a new decision") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => restoreCatalogSemanticRevision(
			tx, params, actor, body.expectedRevision, params.semanticId, body.expectedHeadVersion, body.restoreVersion)));
