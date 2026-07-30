import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";
import type { EmbeddableSearchTemplateId } from "@rezics/filter";
import { searchParamsParsers } from "@/lib/search-params";
import { createSerializer } from "nuqs/server";

export interface TagSearchTarget {
	readonly tagId: string;
	readonly label: string;
}

const serializeSearch = createSerializer(searchParamsParsers);

function tagSearchTemplate(type: CatalogDetailUnitType): EmbeddableSearchTemplateId {
	return type === "series" ? "global" : type;
}

export function unitTagsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/tags`;
}

export function tagSearchHref(
	type: CatalogDetailUnitType,
	tags: readonly TagSearchTarget[],
): string {
	const unique = new Map(tags.map((tag) => [tag.tagId, tag]));
	return `/search${serializeSearch({
		template: tagSearchTemplate(type),
		tag: [...unique.values()].map(({ tagId }) => tagId),
		tagLabel: [...unique.values()].map(({ label }) => label),
	})}`;
}

export function tagDetailHref(tagId: string): string {
	return `/tags/${tagId}`;
}

export function tagStructureHref(structureId: string): string {
	return `/tag-structures/${structureId}`;
}
