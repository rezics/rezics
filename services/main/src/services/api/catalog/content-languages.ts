import Elysia from "elysia";
import { z } from "zod";
import session from "../../auth/session";
import { CatalogReferenceNotFound } from "../../catalog/storage";
import { catalogRead, catalogMutation } from "./transaction";
import {
	ContentLanguageDeclarationReferenceSchema,
	ContentLanguageDeclarationPutSchema,
	ContentLanguageDeclarationSchema,
	ContentLanguageDeclarationMutationSchema,
	ContentLanguageDeclarationRestoreSchema,
	ContentLanguageDeclarationHistoryQuerySchema,
	ContentLanguageDeclarationHistorySchema,
	ContentLanguageDeclarationHistoryValueSchema,
	readCatalogContentLanguageSupport,
	replaceCatalogContentLanguageSupport,
	listCatalogContentLanguageHistory,
	readCatalogContentLanguageHistoryValue,
	restoreCatalogContentLanguageSupport,
} from "../../catalog/content-language-declaration";
import {
	CatalogContentLanguageEvidenceSchema,
	listCatalogContentLanguageEvidence,
} from "../../catalog/content-language-evidence";
const path = ContentLanguageDeclarationReferenceSchema;
const historyPath = path.extend({
	version: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
});
const detail = (operationId: string, summary: string) => ({
	operationId,
	summary,
	tags: ["Catalog content languages"],
});
function editor(actor: string | null): string {
	if (!actor) throw new CatalogReferenceNotFound();
	return actor;
}
/** @alpha Native consumption-language declarations, independent of provider language observations. */
export default new Elysia({
	name: "catalog-content-languages-api",
	prefix: "/resources/:owner/:id/content-language-support",
})
	.use(session)
	.get(
		"",
		{
			params: path,
			response: ContentLanguageDeclarationSchema,
			detail: detail(
				"readCatalogContentLanguageSupport",
				"Read an explicit native consumption-language declaration",
			),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => readCatalogContentLanguageSupport(tx, params, actor)),
	)
	.put(
		"",
		{
			access: "contribute:unit:update",
			params: path,
			body: ContentLanguageDeclarationPutSchema,
			response: ContentLanguageDeclarationMutationSchema,
			detail: detail(
				"replaceCatalogContentLanguageSupport",
				"Replace one native declaration with exact owner and field revisions",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				replaceCatalogContentLanguageSupport(tx, params, actor, body),
			),
	)
	.get(
		"/evidence",
		{
			params: path,
			response: CatalogContentLanguageEvidenceSchema,
			detail: detail(
				"listCatalogContentLanguageEvidence",
				"Read existing direct native-link language evidence without inheritance",
			),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) => listCatalogContentLanguageEvidence(tx, params, actor)),
	)
	.get(
		"/history",
		{
			params: path,
			query: ContentLanguageDeclarationHistoryQuerySchema,
			response: ContentLanguageDeclarationHistorySchema,
			detail: detail(
				"listCatalogContentLanguageHistory",
				"List native declaration decisions by field revision",
			),
		},
		({ params, query, request }) =>
			catalogRead(request, (tx, actor) =>
				listCatalogContentLanguageHistory(tx, params, editor(actor), query),
			),
	)
	.get(
		"/history/:version",
		{
			params: historyPath,
			response: ContentLanguageDeclarationHistoryValueSchema,
			detail: detail(
				"readCatalogContentLanguageHistory",
				"Read one exact historical native declaration",
			),
		},
		({ params, request }) =>
			catalogRead(request, (tx, actor) =>
				readCatalogContentLanguageHistoryValue(
					tx,
					{ owner: params.owner, id: params.id },
					editor(actor),
					params.version,
				),
			),
	)
	.post(
		"/restore",
		{
			access: "contribute:unit:update",
			params: path,
			body: ContentLanguageDeclarationRestoreSchema,
			response: ContentLanguageDeclarationMutationSchema,
			detail: detail(
				"restoreCatalogContentLanguageSupport",
				"Restore a native language declaration as a new decision",
			),
		},
		({ params, body, participation }) =>
			catalogMutation(participation, (tx, actor) =>
				restoreCatalogContentLanguageSupport(tx, params, actor, body),
			),
	);
