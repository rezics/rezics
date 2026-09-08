import Elysia from "elysia";
import mergedSources from "./merged-sources";
import { z } from "zod";
import session from "../../auth/session";
import { CatalogOwnerValues } from "../../catalog/contracts";
import {
	CreateCatalogResourceSchema,
	CatalogCreatedSchema,
	CatalogResourceSchema,
	CatalogLifecycleInputSchema,
	CatalogMutationSchema,
	CatalogNamePageSchema,
	CatalogIdentifierPageSchema,
	CatalogNamedFormSchema,
	CatalogIdentifierSchema,
	CatalogNameCreatedSchema,
	CatalogIdentifierCreatedSchema,
	AddCatalogNameSchema,
	EditCatalogNameSchema,
	AddCatalogIdentifierSchema,
	EditCatalogIdentifierSchema,
	CatalogCursorQuerySchema,
} from "../../catalog/resource-contracts";
import {
	createCatalogResource,
	readCatalogResource,
	updateCatalogLifecycle,
	pageCatalogNames,
	pageCatalogIdentifiers,
	presentCatalogName,
	presentCatalogIdentifier,
} from "../../catalog/resources";
import { addCatalogName, reviseCatalogName } from "../../catalog/names";
import { addCatalogIdentifier, reviseCatalogIdentifier } from "../../catalog/identifiers";
import { catalogRead, catalogMutation } from "./transaction";

const reference = z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() });
const nameReference = reference.extend({ nameId: z.uuid() });
const identifierReference = reference.extend({ identifierId: z.uuid() });
const namesQuery = CatalogCursorQuerySchema.extend({
	maxSpoiler: z.coerce.number().int().min(0).max(2).default(0),
});

/** @alpha Native owner resources and independently versioned forms; source acquisition has a separate review boundary. */
export default new Elysia({ prefix: "/catalog", name: "catalog-api" })
	.use(session)
	.use(mergedSources)
	.post(
		"/resources",
		{
			access: "contribute:unit:create",
			body: CreateCatalogResourceSchema,
			response: CatalogCreatedSchema,
			detail: {
				operationId: "createCatalogResource",
				summary: "Create a native catalog resource",
				tags: ["Catalog"],
			},
		},
		({ participation, body }) =>
			catalogMutation(participation, (tx, actor) => createCatalogResource(tx, actor, body)),
	)
	.get(
		"/resources/:owner/:id",
		{
			params: reference,
			response: CatalogResourceSchema,
			detail: {
				operationId: "readCatalogResource",
				summary: "Read native catalog metadata",
				tags: ["Catalog"],
			},
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readCatalogResource(tx, params, actor)),
	)
	.patch(
		"/resources/:owner/:id/lifecycle",
		{
			access: "contribute:unit:update",
			params: reference,
			body: CatalogLifecycleInputSchema,
			response: CatalogMutationSchema,
			detail: {
				operationId: "updateCatalogLifecycle",
				summary: "Change catalog publication and visibility",
				tags: ["Catalog"],
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				updateCatalogLifecycle(tx, params, actor, body),
			),
	)
	.get(
		"/resources/:owner/:id/names",
		{
			params: reference,
			query: namesQuery,
			response: CatalogNamePageSchema,
			detail: {
				operationId: "listCatalogNames",
				summary: "List independently versioned catalog names",
				tags: ["Catalog"],
			},
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageCatalogNames(tx, params, actor, query)),
	)
	.post(
		"/resources/:owner/:id/names",
		{
			access: "contribute:unit:update",
			params: reference,
			body: AddCatalogNameSchema,
			response: CatalogNameCreatedSchema,
			detail: { operationId: "addCatalogName", summary: "Add a catalog name", tags: ["Catalog"] },
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				addCatalogName(tx, params, actor, body.expectedRevision, body.value),
			),
	)
	.put(
		"/resources/:owner/:id/names/:nameId",
		{
			access: "contribute:unit:update",
			params: nameReference,
			body: EditCatalogNameSchema,
			response: CatalogNamedFormSchema,
			detail: {
				operationId: "reviseCatalogName",
				summary: "Revise a catalog name with its exact current revision",
				tags: ["Catalog"],
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentCatalogName(
					await reviseCatalogName(
						tx,
						params,
						actor,
						params.nameId,
						body.expectedRevision,
						body.value,
					),
				),
			),
	)
	.get(
		"/resources/:owner/:id/identifiers",
		{
			params: reference,
			query: CatalogCursorQuerySchema,
			response: CatalogIdentifierPageSchema,
			detail: {
				operationId: "listCatalogIdentifiers",
				summary: "List catalog identifier claims",
				tags: ["Catalog"],
			},
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) => pageCatalogIdentifiers(tx, params, actor, query)),
	)
	.post(
		"/resources/:owner/:id/identifiers",
		{
			access: "contribute:unit:update",
			params: reference,
			body: AddCatalogIdentifierSchema,
			response: CatalogIdentifierCreatedSchema,
			detail: {
				operationId: "addCatalogIdentifier",
				summary: "Add an identifier claim without merging identities",
				tags: ["Catalog"],
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, (tx, actor) =>
				addCatalogIdentifier(tx, params, actor, body.expectedRevision, body.value),
			),
	)
	.put(
		"/resources/:owner/:id/identifiers/:identifierId",
		{
			access: "contribute:unit:update",
			params: identifierReference,
			body: EditCatalogIdentifierSchema,
			response: CatalogIdentifierSchema,
			detail: {
				operationId: "reviseCatalogIdentifier",
				summary: "Revise an exact identifier claim",
				tags: ["Catalog"],
			},
		},
		({ params, participation, body }) =>
			catalogMutation(participation, async (tx, actor) =>
				presentCatalogIdentifier(
					await reviseCatalogIdentifier(
						tx,
						params,
						actor,
						params.identifierId,
						body.expectedRevision,
						body.value,
					),
				),
			),
	);
