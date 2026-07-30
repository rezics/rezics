import {
	CatalogDetailSections,
	isCatalogDetailSectionFor,
	type CatalogDetailSectionIdFor,
	type CatalogDetailUnitType,
} from "../model/catalog-detail-section";

export function catalogDetailHref<Type extends CatalogDetailUnitType>(
	type: Type,
	unitId: string,
	sectionId: CatalogDetailSectionIdFor<Type> = "overview",
): string {
	const base = `/units/${type}/${unitId}`;
	return sectionId === "overview" ? base : `${base}/${sectionId}`;
}

export function catalogCreditsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/credits`;
}

export function catalogReviewsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/reviews`;
}

export function catalogExcerptsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/excerpts`;
}

export function catalogQuestionsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/questions`;
}

export function catalogTagsHref(type: CatalogDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/tags`;
}

export function parseCatalogDetailSection<Type extends CatalogDetailUnitType>(
	pathname: string,
	type: Type,
	unitId: string,
): CatalogDetailSectionIdFor<Type> | undefined {
	const base = catalogDetailHref(type, unitId);
	if (pathname === base || pathname === `${base}/`) return "overview";
	if (!pathname.startsWith(`${base}/`)) return undefined;
	const suffix = pathname.slice(base.length + 1);
	return !suffix.includes("/") && isCatalogDetailSectionFor(type, suffix) ? suffix : undefined;
}

export function getCatalogDetailHrefs<Type extends CatalogDetailUnitType>(
	type: Type,
	unitId: string,
): readonly {
	readonly id: CatalogDetailSectionIdFor<Type>;
	readonly href: string;
}[] {
	return CatalogDetailSections[type].map((id) => ({
		id,
		href: catalogDetailHref(type, unitId, id),
	}));
}
