import { z } from "zod";
import { canonicalizeContentLanguageTag } from "@rezics/content-language";
import { isContentLanguage } from "@rezics/i18n";
import { sql } from "drizzle-orm";
import { CatalogOwnerValues, type UnitOwner } from "@rezics/reference";
import { AvatarTypeValues, FontAwesomeIconPrefixValues, type PresentedAvatar } from "@rezics/avatar";
import { database, type DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { CatalogEditorialTables } from "../database/schema/catalog-editorial";
import { unitStateRelation } from "./state-relation";
import { presentAvatar } from "./avatar";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	avatarReferenceFromColumns,
} from "./localization";

export type UnitPresentation = {
	readonly id: string;
	readonly owner: UnitOwner;
	readonly shape: string;
	readonly language: string | null;
	readonly title: string | null;
	readonly summary: string | null;
	readonly avatar: PresentedAvatar | null;
};
/** Hydrates only already-authorized IDs in the caller's consistent transaction; private routing fields never leave this projection. @internal */
export async function readUnitPresentationsInTransaction(
	tx: DatabaseTransaction,
	unitIds: readonly string[],
	languages: readonly string[] = [],
	options: { readonly includeDeleted?: boolean } = {},
): Promise<Map<string, UnitPresentation>> {
	const ids = z
		.array(z.uuid())
		.max(500)
		.parse([...new Set(unitIds)]);
	if (!ids.length) return new Map();
	if (languages.length > 32)
		throw new RangeError("Presentation language preferences exceed the bounded grammar");
	const canonicalLanguages = [...new Set(languages.map(canonicalizeContentLanguageTag))];
	const platformLanguages = canonicalLanguages.map(language => language.toString()).filter(isContentLanguage);
	const candidates = database
		.select({ id: sql<string>`requested.id`.as("id") })
		.from(sql`unnest(${sql.param(ids)}::uuid[]) as requested(id)`)
		.as("requested_presentation_ids");
	const state = unitStateRelation(
		candidates.id,
		"presentation_state",
		options.includeDeleted ?? false,
	);
	const rows = await tx
		.select({
			id: state.id,
			owner: state.owner,
			shape: state.shape,
			language: resolvedUnitLocalizationLanguage(state.id, platformLanguages),
			title:sql<string|null>`left(${resolvedUnitLocalizationTitle(state.id, platformLanguages)},500)`,
			summary:sql<string|null>`left(${resolvedUnitLocalizationSummary(state.id, platformLanguages)},2000)`,
			avatar: resolvedUnitLocalizationAvatar(state.id, platformLanguages),
		})
		.from(candidates)
		.innerJoinLateral(state, sql`true`)
		.limit(ids.length);
	const nativeOwners = new Set<string>(CatalogOwnerValues);
	const result = new Map<string, UnitPresentation>(
		rows.map(({ avatar, ...row }) => [
			row.id,
			{
				...row,
				...(nativeOwners.has(row.owner) ? { title: null, language: null } : {}),
				avatar: presentAvatar(avatar),
			},
		]),
	);
	for (const owner of CatalogOwnerValues) {
		const owned = rows.filter((row) => row.owner === owner).map((row) => row.id);
		if (!owned.length) continue;
		const names = CatalogNameTables[owner].name;
		const editorial = CatalogEditorialTables[owner].current;
		for (let offset = 0; offset < owned.length; offset += 100) {
			const batch = owned.slice(offset, offset + 100);
			// Each preferred language uses its partial index; only the chosen full value is read.
			const labels = await tx.execute(sql`
  select requested.owner_id,left(selected_name.value,500) as value,selected_name.language_tag
  from unnest(${sql.param(batch)}::uuid[]) requested(owner_id)
  left join lateral (
   select candidate.id from unnest(${sql.param(canonicalLanguages)}::text[]) with ordinality wanted(language_tag,priority)
   cross join lateral (
    select ${names.id} as id from ${names}
    where ${names.ownerId}=requested.owner_id and ${names.languageTag}=wanted.language_tag and ${names.state}='active' and ${names.spoiler}=0 and ${names.scopeOwnerId} is null
    order by coalesce(${names.primaryForLanguage},false) desc,${names.id} limit 1
   ) candidate order by wanted.priority limit 1
  ) preferred on true
  left join lateral (
   select ${names.id} as id from ${names}
   where ${names.ownerId}=requested.owner_id and ${names.state}='active' and ${names.spoiler}=0 and ${names.scopeOwnerId} is null
   order by ${names.id} limit 1
  ) fallback on preferred.id is null
  join ${names} selected_name on selected_name.owner_id=requested.owner_id and selected_name.id=coalesce(preferred.id,fallback.id)
 `);
			for (const row of z
				.array(
					z.object({
						owner_id: z.uuid(),
						value: z.string(),
						language_tag: z.string().nullable(),
					}),
				)
				.max(100)
				.parse(labels.rows)) {
				const previous = result.get(row.owner_id);
				if (previous)
					result.set(row.owner_id, {
						...previous,
						title: row.value,
						language: row.language_tag,
					});
			}
			const presentationRows = await tx.execute(sql`
 select requested.owner_id, chosen.language, chosen.summary,
 chosen.avatar_type,chosen.avatar_asset_id,chosen.avatar_emoji,chosen.avatar_icon_prefix,chosen.avatar_icon_name
 from unnest(${sql.param(batch)}::uuid[]) requested(owner_id)
 join lateral (
  select language,summary,avatar_type,avatar_asset_id,avatar_emoji,avatar_icon_prefix,avatar_icon_name from ${editorial}
  where owner_id=requested.owner_id and state='active'
  order by coalesce(array_position(${sql.param(canonicalLanguages)}::text[],language),2147483647),language limit 1
 ) chosen on true`);
			for(const row of z.array(z.object({owner_id:z.uuid(),language:z.string(),summary:z.string().nullable(),
				avatar_type:z.enum(AvatarTypeValues).nullable(),avatar_asset_id:z.uuid().nullable(),avatar_emoji:z.string().nullable(),
				avatar_icon_prefix:z.enum(FontAwesomeIconPrefixValues).nullable(),avatar_icon_name:z.string().nullable()})).max(100).parse(presentationRows.rows)) {
				const previous=result.get(row.owner_id);
				if(previous) result.set(row.owner_id,{...previous,summary:row.summary,
					avatar:presentAvatar(avatarReferenceFromColumns({avatarType:row.avatar_type,avatarAssetId:row.avatar_asset_id,
						avatarEmoji:row.avatar_emoji,avatarIconPrefix:row.avatar_icon_prefix,avatarIconName:row.avatar_icon_name}))});
			}
		}
	}
	return result;
}
