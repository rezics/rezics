import { eq } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";

import { database } from "../database";
import { unit } from "../database/schema";
import {
	resolvedUnitLocalizationImageAssetId,
	resolvedUnitLocalizationSummary,
	resolvedUnitLocalizationTitle,
} from "../units/localization";
import { presentImageAsset } from "../units/service";

export async function getPostSubjectPresentation(
	subjectId: string,
	localizationLanguages: readonly ContentLanguage[] = [],
) {
	const [subject] = await database
		.select({
			id: unit.id,
			type: unit.kind,
			title: resolvedUnitLocalizationTitle(unit.id, localizationLanguages),
			summary: resolvedUnitLocalizationSummary(unit.id, localizationLanguages),
			coverAssetId: resolvedUnitLocalizationImageAssetId(
				unit.id,
				"cover",
				localizationLanguages,
			),
		})
		.from(unit)
		.where(eq(unit.id, subjectId))
		.limit(1);
	if (!subject) return null;
	const { coverAssetId, ...presentation } = subject;
	return {
		...presentation,
		cover: presentImageAsset(coverAssetId, "cover"),
	};
}
