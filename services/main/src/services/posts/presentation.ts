import { sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../database";
import { unitStateRelation } from "../units/state-relation";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationLanguage,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { presentImageAsset } from "../units/service";

export async function getPostSubjectPresentation(
	subjectId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const unit = unitStateRelation(sql`${subjectId}::uuid`, "post_subject_state");
	const [subject] = await database
		.select({
			id: unit.id,
			type: unit.owner,
			language: resolvedUnitLocalizationLanguage(unit.id, localizationLanguages),
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(unit.id, localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(unit.id, "cover", localizationLanguages),
		})
		.from(unit)
		.limit(1);
	if (!subject?.language) return null;
	const { coverAssetId, language, ...presentation } = subject;
	return {
		...presentation,
		language,
		cover: presentImageAsset(coverAssetId, "cover"),
	};
}
