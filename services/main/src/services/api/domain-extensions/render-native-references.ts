import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { parseContentLanguageTag } from "@rezics/content-language";
import { CatalogReferenceSchema } from "@rezics/reference";
import { inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { UnitAuthorization } from "../../authorization/unit/authorization";
import { database } from "../../database";
import { catalogUnitLocator } from "../../database/schema/catalog-identity";
import { CatalogNameTables } from "../../database/schema/catalog-names";

const NativeNamePreviewRow = z.object({
	id: z.uuid(),
	value: z.string(),
	language_tag: z.string().nullable(),
	language_policy: z.string().nullable(),
	private_use_namespace: z.string().nullable(),
});

/**
 * At most 500 owner IDs, one preview-index seek and one 500-character label each.
 * At 500M or 3B names, work remains O(500 log N), at most eight owner batches,
 * and at most 1MB UTF-8 label text. Stored BCP 47 policy and exact tags are retained.
 * This deterministic first visible label does not rank authority or implied officialness.
 */
export async function readNativeZoneRenderReferences(
	ids: readonly string[],
	authorization: Pick<UnitAuthorization<string | undefined>, "readableUnitIds">,
) {
	if (ids.length > 500) throw new RangeError("Zone render reference limit exceeded");
	if (!ids.length) return [];
	const routes = await database
		.select({ id: catalogUnitLocator.id, owner: catalogUnitLocator.owner })
		.from(catalogUnitLocator)
		.where(inArray(catalogUnitLocator.id, [...ids]));
	const readableBefore = await authorization.readableUnitIds(ids);
	const native = routes
		.filter((route) => readableBefore.has(route.id))
		.flatMap((route) => {
			const parsed = CatalogReferenceSchema.safeParse(route);
			return parsed.success ? [parsed.data] : [];
		});
	const items: {
		id: string;
		kind: string;
		zonePageSlug: null;
		language: ContentLanguage | null;
		languageTag: string | null;
		title: string;
		summary: null;
		avatar: null;
		banner: null;
		cover: null;
	}[] = [];
	for (const owner of new Set(native.map((reference) => reference.owner))) {
		const selectedIds = native
			.filter((reference) => reference.owner === owner)
			.map((reference) => reference.id);
		const name = CatalogNameTables[owner].name;
		const result = await database.execute(
			sql`select candidate.id, label.value, label.language_tag, label.language_policy, label.private_use_namespace from unnest(${sql.param(selectedIds)}::uuid[]) candidate(id) join lateral (select left(${name.value}, 500) as value, ${name.languageTag} as language_tag, ${name.languagePolicy} as language_policy, ${name.privateUseNamespace} as private_use_namespace from ${name} where ${name.ownerId}=candidate.id and ${name.state}='active' and ${name.spoiler}=0 and ${name.scopeOwnerId} is null order by ${name.id} limit 1) label on true`,
		);
		for (const row of z.array(NativeNamePreviewRow).parse(result.rows)) {
			if (row.language_tag !== null) {
				const parsed = parseContentLanguageTag(row.language_tag, {
					privateUseNamespace: row.private_use_namespace ?? undefined,
				});
				if (parsed.tag !== row.language_tag || parsed.policy !== row.language_policy)
					throw new Error("Catalog name language requires an explicit policy migration");
			} else if (row.language_policy !== null || row.private_use_namespace !== null)
				throw new Error("Invalid catalog name language metadata");
			const language = ContentLanguageValues.find((value) => value === row.language_tag) ?? null;
			items.push({
				id: row.id,
				kind: owner,
				zonePageSlug: null,
				language,
				languageTag: row.language_tag,
				title: row.value,
				summary: null,
				avatar: null,
				banner: null,
				cover: null,
			});
		}
	}
	const readable = await authorization.readableUnitIds(items.map((item) => item.id));
	return items.filter((item) => readable.has(item.id));
}
