import { ContentLanguageValues, type ContentLanguage } from "@rezics/i18n";
import { CatalogReferenceSchema } from "@rezics/reference";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { DatabaseTransaction } from "../database";
import { catalogUnitLocator } from "@rezics/schema/postgres/catalog/identity";
import {
	audio,
	video,
	label,
	post,
	unitLocalization,
	unitLocalizationContentMetric,
} from "../database/schema";
import { CatalogNameTables } from "@rezics/schema/postgres/knowledge/names";
import { z } from "zod";
import { resolvedUnitLocalizationLanguage } from "../units/localization";
import { unitStateRelation } from "../units/state-relation";
import { MaximumContentStructureNodes } from "./contracts";
import { ContentStructureInvalid } from "./errors";

/** Internal metadata for an already-authorized bounded structure/attachment set. */
export async function readContentStructureContentRows(
	tx: DatabaseTransaction,
	ids: readonly string[],
	languages: readonly ContentLanguage[] = [],
) {
	const selected = [...new Set(ids)];
	if (selected.length > MaximumContentStructureNodes)
		throw new ContentStructureInvalid("Content Structure target limit exceeded");
	if (!selected.length) return [];
	const state = unitStateRelation(catalogUnitLocator.id, "structure_content_state");
	const rows = await tx
		.select({
			id: state.id,
			unitKind: state.owner,
			shape: state.shape,
			status: state.status,
			postKind: post.kind,
			labelId: label.id,
			videoId: video.id,
			audioId: audio.id,
			durationSeconds: sql<
				number | null
			>`coalesce(${video.durationSeconds}, ${audio.durationSeconds})`,
			title: unitLocalization.title,
			language: unitLocalization.language,
			wordCount: unitLocalizationContentMetric.wordCount,
			characterCount: unitLocalizationContentMetric.characterCount,
		})
		.from(catalogUnitLocator)
		.innerJoinLateral(state, sql`true`)
		.leftJoin(post, eq(post.id, state.id))
		.leftJoin(label, eq(label.id, state.id))
		.leftJoin(video, eq(video.id, state.id))
		.leftJoin(audio, eq(audio.id, state.id))
		.leftJoin(
			unitLocalization,
			and(
				eq(unitLocalization.unitId, state.id),
				eq(unitLocalization.language, resolvedUnitLocalizationLanguage(state.id, languages)),
			),
		)
		.leftJoin(
			unitLocalizationContentMetric,
			and(
				eq(unitLocalizationContentMetric.unitId, state.id),
				eq(unitLocalizationContentMetric.language, unitLocalization.language),
			),
		)
		.where(inArray(catalogUnitLocator.id, selected));
	const labels = new Map<string, { value: string; languageTag: string | null }>();
	const native = rows.flatMap((row) => {
		const ref = CatalogReferenceSchema.safeParse({ owner: row.unitKind, id: row.id });
		return ref.success ? [ref.data] : [];
	});
	for (const owner of new Set(native.map((ref) => ref.owner))) {
		const group = native.filter((ref) => ref.owner === owner).map((ref) => ref.id);
		const name = CatalogNameTables[owner].name;
		const result = await tx.execute(
			sql`select candidate.id, label.value, label.language_tag from unnest(${sql.param(group)}::uuid[]) candidate(id) join lateral (select left(${name.value},500) as value, ${name.languageTag} as language_tag from ${name} where ${name.ownerId}=candidate.id and ${name.state}='active' and ${name.spoiler}=0 and ${name.scopeOwnerId} is null order by ${name.id} limit 1) label on true`,
		);
		for (const row of z
			.array(z.object({ id: z.uuid(), value: z.string(), language_tag: z.string().nullable() }))
			.parse(result.rows))
			labels.set(row.id, { value: row.value, languageTag: row.language_tag });
	}
	const nativeIds = new Set(native.map((ref) => ref.id));
	return rows.map((row) => ({
		...row,
		title: nativeIds.has(row.id) ? (labels.get(row.id)?.value ?? null) : row.title,
		language: nativeIds.has(row.id)
			? (ContentLanguageValues.find((language) => language === labels.get(row.id)?.languageTag) ??
				null)
			: row.language,
		languageTag: nativeIds.has(row.id) ? (labels.get(row.id)?.languageTag ?? null) : row.language,
	}));
}
