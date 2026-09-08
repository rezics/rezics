import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { catalogMutation, catalogRead } from "./transaction";
import { CatalogDefinitionQuerySchema, CatalogDefinitionPageSchema, CatalogDefinitionSchema,
	CatalogDefinitionRevisionSchema, CatalogDefinitionHistorySchema, CatalogDefinitionHistoryQuerySchema,
	CreateCatalogDefinitionSchema, ReviseCatalogDefinitionSchema,
	CatalogDefinitionRevisionLabelsQuerySchema, CatalogDefinitionRevisionLabelsSchema } from "../../catalog/definition-api-contracts";
import { catalogDefinitionPermissions, pageCatalogDefinitions, readCatalogDefinition, readCatalogDefinitionRevision,
	pageCatalogDefinitionHistory, createCatalogDefinition, reviseCatalogApiDefinition, readCatalogDefinitionRevisionLabels } from "../../catalog/definition-api";
const id = z.strictObject({ id: z.uuid() });
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["Catalog definitions"] });
export default new Elysia({ prefix: "/definitions", name: "catalog-definitions-api" }).use(session)
	.get("/permissions", { response: z.strictObject({ canManage: z.boolean() }), detail: detail("getCatalogDefinitionPermissions", "Read current definition management access") },
		({ request }) => catalogRead(request, catalogDefinitionPermissions))
	.get("/revision-labels", { query: CatalogDefinitionRevisionLabelsQuerySchema, response: CatalogDefinitionRevisionLabelsSchema,
		detail: detail("listCatalogDefinitionRevisionLabels", "Read names for an exact page of immutable definition dependencies") },
		({ query, request }) => catalogRead(request, tx => readCatalogDefinitionRevisionLabels(tx, query)))
	.get("", { query: CatalogDefinitionQuerySchema, response: CatalogDefinitionPageSchema, detail: detail("listCatalogDefinitions", "Choose governed property, relation and vocabulary meanings") },
		({ query, request }) => catalogRead(request, tx => pageCatalogDefinitions(tx, query)))
	.get("/revisions/:id", { params: id, response: CatalogDefinitionRevisionSchema, detail: detail("getCatalogDefinitionRevision", "Read an exact immutable definition revision") },
		({ params, request }) => catalogRead(request, tx => readCatalogDefinitionRevision(tx, params.id)))
	.get("/:id", { params: id, response: CatalogDefinitionSchema, detail: detail("getCatalogDefinition", "Read a definition and its current reviewed meaning") },
		({ params, request }) => catalogRead(request, tx => readCatalogDefinition(tx, params.id)))
	.get("/:id/revisions", { params: id, query: CatalogDefinitionHistoryQuerySchema, response: CatalogDefinitionHistorySchema,
		detail: detail("listCatalogDefinitionRevisions", "Read a definition's immutable history") },
		({ params, query, request }) => catalogRead(request, tx => pageCatalogDefinitionHistory(tx, params.id, query)))
	.post("", { access: "session-only", body: CreateCatalogDefinitionSchema, response: CatalogDefinitionRevisionSchema,
		detail: detail("createCatalogDefinition", "Create a governed meaning with its localized names") },
		({ body, participation }) => catalogMutation(participation, (tx, actor) => createCatalogDefinition(tx, actor, body)))
	.post("/:id/revisions", { access: "session-only", params: id, body: ReviseCatalogDefinitionSchema, response: CatalogDefinitionRevisionSchema,
		detail: detail("reviseCatalogDefinition", "Append a reviewed meaning without changing existing facts") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) => reviseCatalogApiDefinition(tx, actor, params.id, body)));
