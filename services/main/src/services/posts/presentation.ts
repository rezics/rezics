import { and, eq, isNull, sql } from "drizzle-orm";
import type { ContentLanguage } from "@rezics/i18n";
import { CatalogReferenceSchema } from "@rezics/reference";

import { database } from "../database";
import { CatalogNameTables } from "../database/schema/catalog-names";
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
	if (!subject) return null;
	const native = CatalogReferenceSchema.safeParse({ owner: subject.type, id: subject.id });
	if (native.success) {
		const names = CatalogNameTables[native.data.owner].name;
		const [name] = await database
			.select({ title: names.value, language: names.languageTag })
			.from(names)
			.where(
				and(
					eq(names.ownerId, subject.id),
					eq(names.state, "active"),
					eq(names.spoiler, 0),
					isNull(names.scopeOwnerId),
				),
			)
			.orderBy(names.id)
			.limit(1);
		return {
			id: subject.id,
			type: subject.type,
			language: name?.language ?? null,
			title: name?.title ?? null,
			summary: null,
			cover: null,
		};
	}
	if (!subject?.language) return null;
	const { coverAssetId, language, ...presentation } = subject;
	return {
		...presentation,
		language,
		cover: presentImageAsset(coverAssetId, "cover"),
	};
}
