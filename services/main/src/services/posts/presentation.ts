import { eq } from "drizzle-orm";

import { database } from "../database";
import { unit } from "../database/schema";
import {
	firstUnitLocalizationCoverAssetId,
	primaryUnitSummary,
	primaryUnitTitle,
} from "../units/localization";
import { presentImageAsset } from "../units/service";

export async function getPostSubjectPresentation(subjectId: string) {
	const [subject] = await database
		.select({
			id: unit.id,
			type: unit.kind,
			title: primaryUnitTitle(unit.id),
			summary: primaryUnitSummary(unit.id),
			coverAssetId: firstUnitLocalizationCoverAssetId(unit.id),
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
