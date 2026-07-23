import type { CatalogDetailUnitType } from "@/features/units/model/catalog-detail-section";

export function unitTagsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/tags`;
}

export function tagSearchHref(type: CatalogDetailUnitType, tagId: string, label: string): string {
	const query = new URLSearchParams({ template: type, tag: tagId, tagLabel: label });
	return `/search?${query.toString()}`;
}

export function tagDetailHref(tagId: string): string {
	return `/tags/${tagId}`;
}

export function tagStructureHref(structureId: string): string {
	return `/tag-structures/${structureId}`;
}
