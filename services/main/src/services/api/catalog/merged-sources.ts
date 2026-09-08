import Elysia from "elysia";
import { z } from "zod";
import { CatalogOwnerValues } from "@rezics/reference";
import { catalogRead } from "./transaction";
import { listMergedCatalogSources } from "../../units/merge/public-sources";
import { MergeSourcePreviewSchema, mergePage } from "../../units/merge/contracts";
const reference = z.strictObject({ owner: z.enum(CatalogOwnerValues), id: z.uuid() });
export default new Elysia().get(
	"/resources/:owner/:id/merged-sources",
	{
		params: reference,
		query: z.strictObject({
			limit: z.coerce.number().int().min(1).max(20).default(10),
			cursor: z.uuid().optional(),
		}),
		response: mergePage(MergeSourcePreviewSchema),
		detail: {
			operationId: "listMergedCatalogSources",
			summary: "Find retained source records and their reconciliation policies",
			tags: ["Catalog"],
		},
	},
	({ params, query, request }) =>
		catalogRead(request, (tx, actor) => listMergedCatalogSources(tx, params, actor, query)),
);
