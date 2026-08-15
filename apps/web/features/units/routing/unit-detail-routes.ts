import {
	UnitDetailSections,
	isUnitDetailSectionFor,
	type UnitDetailSectionIdFor,
	type UnitDetailUnitType,
} from "../model/unit-detail-section";

export function unitDetailHref<Type extends UnitDetailUnitType>(
	type: Type,
	unitId: string,
	sectionId: UnitDetailSectionIdFor<Type> = "overview",
): string {
	const base = `/units/${type}/${unitId}`;
	return sectionId === "overview" ? base : `${base}/${sectionId}`;
}

export function unitCreditsHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/credits`;
}

export function unitReviewsHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/reviews`;
}

export function unitExcerptsHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/excerpts`;
}

export function unitQuestionsHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/questions`;
}

/** Addresses one Chapter occurrence in a Book; `nodeId` is not the Chapter Post ID. */
export function bookReaderHref(bookId: string, nodeId: string): string {
	return `/units/book/${bookId}/read/${nodeId}`;
}

export function unitTagsHref(type: UnitDetailUnitType, unitId: string): string {
	return `/units/${type}/${unitId}/tags`;
}

export function parseUnitDetailSection<Type extends UnitDetailUnitType>(
	pathname: string,
	type: Type,
	unitId: string,
): UnitDetailSectionIdFor<Type> | undefined {
	const base = unitDetailHref(type, unitId);
	if (pathname === base || pathname === `${base}/`) return "overview";
	if (!pathname.startsWith(`${base}/`)) return undefined;
	const suffix = pathname.slice(base.length + 1);
	return !suffix.includes("/") && isUnitDetailSectionFor(type, suffix) ? suffix : undefined;
}

export function getUnitDetailHrefs<Type extends UnitDetailUnitType>(
	type: Type,
	unitId: string,
): readonly {
	readonly id: UnitDetailSectionIdFor<Type>;
	readonly href: string;
}[] {
	return UnitDetailSections[type].map((id) => ({
		id,
		href: unitDetailHref(type, unitId, id),
	}));
}
