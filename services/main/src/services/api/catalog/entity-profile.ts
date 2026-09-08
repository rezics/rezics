import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { EntityProfileSchema, EntityShapeSchema } from "../../catalog/entity-contracts";
import { initializeEntityProfile, readEntityProfile, readEntityProfileHistory, removeEntityProfile,
	restoreEntityProfile, resolveEntityShape } from "../../catalog/entities";
import { DomainPageQuerySchema, decodeDomainCursor, domainPage } from "../../catalog/domain-api-pagination";
import { CatalogRevisionNumberSchema } from "../../catalog/name-contracts";
import { catalogRead, catalogMutation } from "./transaction";
import { catalogDomainHistory } from "./domain-read";

const params = z.strictObject({ id: z.uuid() });
const edit = z.strictObject({ expectedRevision: CatalogRevisionNumberSchema });
const mutation = z.strictObject({ revision: CatalogRevisionNumberSchema });
const reference = (id: string) => ({ owner: "entity" as const, id });
const detail = (operationId: string, summary: string) => ({ operationId, summary, tags: ["Catalog Entity"] });
const history = z.strictObject({ revision: CatalogRevisionNumberSchema, removed: z.boolean(),
	createdAt: z.iso.datetime(), profile: EntityProfileSchema.nullable() });

/** @alpha @remarks Fixed catalog facts use native edit authority; public self-presentation remains controller-authored. */
export default new Elysia({ prefix: "/entity/:id", name: "catalog-entity-profile" }).use(session)
	.get("/profile", { params, response: z.strictObject({ owner: z.literal("entity"), id: z.uuid(),
		shape: EntityShapeSchema, revision: CatalogRevisionNumberSchema, profile: EntityProfileSchema }),
		detail: detail("readCatalogEntityProfile", "Read fixed Entity catalog values") },
		({ params, request }) => catalogRead(request, (tx, actor) => readEntityProfile(tx, reference(params.id), actor)))
	.put("/profile", { access: "contribute:unit:update", params, body: edit.extend({ profile: EntityProfileSchema }), response: mutation,
		detail: detail("writeCatalogEntityProfile", "Set fixed Entity catalog values") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) =>
			initializeEntityProfile(tx, reference(params.id), actor, body.expectedRevision, body.profile)))
	.delete("/profile", { access: "contribute:unit:update", params, body: edit, response: mutation,
		detail: detail("removeCatalogEntityProfile", "Remove fixed values while preserving Entity history") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) =>
			removeEntityProfile(tx, reference(params.id), actor, body.expectedRevision)))
	.post("/shape/resolve", { access: "contribute:unit:update", params, body: edit.extend({ shape: EntityShapeSchema }), response: mutation,
		detail: detail("resolveCatalogEntityShape", "Resolve a previously unresolved Entity shape") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) =>
			resolveEntityShape(tx, reference(params.id), actor, body.expectedRevision, body.shape)))
	.get("/profile/history", { params, query: DomainPageQuerySchema,
		response: z.strictObject({ items: z.array(history).max(100), nextCursor: z.string().nullable() }),
		detail: detail("listCatalogEntityProfileHistory", "Read authorized fixed-profile history") },
		({ params, query, request }) => catalogDomainHistory(request, reference(params.id), async (tx, actor) => {
			const scope = `entity:${params.id}:profile-history`;
			const rows = await readEntityProfileHistory(tx, reference(params.id), actor, {
				limit: query.limit, afterRevision: decodeDomainCursor(scope, query.cursor, CatalogRevisionNumberSchema),
			});
			return domainPage(scope, rows.map(row => ({ revision: row.revision, removed: row.removed,
				createdAt: row.createdAt.toISOString(), profile: row.removed ? null : row.snapshot })), query.limit, row => row.revision);
		}))
	.post("/profile/history/restore", { access: "contribute:unit:update", params,
		body: edit.extend({ historicalRevision: CatalogRevisionNumberSchema }), response: mutation,
		detail: detail("restoreCatalogEntityProfile", "Restore fixed values under current authority") },
		({ params, body, participation }) => catalogMutation(participation, (tx, actor) =>
			restoreEntityProfile(tx, reference(params.id), actor, body.expectedRevision, body.historicalRevision)));
