import { z } from "zod";
import { sql } from "drizzle-orm";
import { CatalogOwnerValues, type UnitOwner } from "@rezics/reference";
import type { PresentedAvatar } from "@rezics/avatar";
import { database, type DatabaseTransaction } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
import { unitStateRelation } from "./state-relation";
import { presentAvatar } from "./avatar";
import {
	resolvedUnitLocalizationAvatar,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
	type LocalizationLanguageQuery,
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
	languages: LocalizationLanguageQuery = [],
): Promise<Map<string, UnitPresentation>> {
	const ids = z
		.array(z.uuid())
		.max(500)
		.parse([...new Set(unitIds)]);
	if (!ids.length) return new Map();
	if (languages.length > 32)
		throw new RangeError("Presentation language preferences exceed the bounded grammar");
	const candidates = database
		.select({ id: sql<string>`unnest(${sql.param(ids)}::uuid[])`.as("id") })
		.as("requested_presentation_ids");
	const state = unitStateRelation(candidates.id, "presentation_state");
	const rows = await tx
		.select({
			id: state.id,
			owner: state.owner,
			shape: state.shape,
			language: resolvedUnitLocalizationLanguage(state.id, languages),
			title: resolvedUnitLocalizationTitle(state.id, languages),
			summary: resolvedUnitLocalizationSummary(state.id, languages),
			avatar: resolvedUnitLocalizationAvatar(state.id, languages),
		})
		.from(candidates)
		.innerJoinLateral(state, sql`true`)
		.limit(ids.length);
	const result = new Map<string, UnitPresentation>(
		rows.map(({ avatar, ...row }) => [row.id, { ...row, avatar: presentAvatar(avatar) }]),
	);
	for (const owner of CatalogOwnerValues) {
		const owned = rows.filter((row) => row.owner === owner).map((row) => row.id);
		if (!owned.length) continue;
		const names = CatalogNameTables[owner].name;
		for (let offset = 0; offset < owned.length; offset += 100) {
			const batch = owned.slice(offset, offset + 100);
			// Read bounded ID/language candidates first; large name values are fetched only for the chosen display forms.
			const candidates = await tx.execute(
				sql`select requested.owner_id,candidate.id,candidate.language_tag,candidate.primary_for_language from unnest(${sql.param(batch)}::uuid[]) requested(owner_id) join lateral(select ${names.id} as id,${names.languageTag} as language_tag,${names.primaryForLanguage} as primary_for_language from ${names} where ${names.ownerId}=requested.owner_id and ${names.state}='active' and ${names.spoiler}=0 and ${names.scopeOwnerId} is null order by ${names.id} limit 32) candidate on true`,
			);
			const parsed = z
				.array(
					z.object({
						owner_id: z.uuid(),
						id: z.uuid(),
						language_tag: z.string().nullable(),
						primary_for_language: z.boolean().nullable(),
					}),
				)
				.max(3200)
				.parse(candidates.rows);
			const byOwner = new Map<string, typeof parsed>();
			for (const row of parsed) {
				const group = byOwner.get(row.owner_id) ?? [];
				group.push(row);
				byOwner.set(row.owner_id, group);
			}
			const chosen: Array<{ ownerId: string; id: string }> = [];
			for (const ownerId of batch) {
				const options = byOwner.get(ownerId) ?? [];
				let selected: (typeof options)[number] | undefined;
				for (const language of languages) {
					const matching = options.filter((row) => row.language_tag === language);
					selected = matching.find((row) => row.primary_for_language === true) ?? matching[0];
					if (selected) break;
				}
				selected ??= options.find((row) => row.primary_for_language === true) ?? options[0];
				if (selected) chosen.push({ ownerId, id: selected.id });
			}
			if (!chosen.length) continue;
			const labels = await tx.execute(
				sql`select ${names.ownerId} as owner_id,${names.value} as value,${names.languageTag} as language_tag from unnest(${sql.param(chosen.map((row) => row.ownerId))}::uuid[],${sql.param(chosen.map((row) => row.id))}::uuid[]) selected(owner_id,id) join ${names} on ${names.ownerId}=selected.owner_id and ${names.id}=selected.id`,
			);
			for (const row of z
				.array(
					z.object({ owner_id: z.uuid(), value: z.string(), language_tag: z.string().nullable() }),
				)
				.max(100)
				.parse(labels.rows)) {
				const previous = result.get(row.owner_id);
				if (previous)
					result.set(row.owner_id, { ...previous, title: row.value, language: row.language_tag });
			}
		}
	}
	return result;
}
