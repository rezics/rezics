import type { UnitManagementSectionId } from "../model/unit-management-section";
import type { UnitType } from "../unit-types";

export function unitHref(type: UnitType, unitId: string): string {
	return `/units/${type}/${unitId}`;
}

export function unitManagementHref(type: UnitType, unitId: string): string {
	return `${unitHref(type, unitId)}/edit`;
}

export function unitManagementSectionHref(
	type: UnitType,
	unitId: string,
	sectionId: UnitManagementSectionId,
): string {
	if (sectionId === "content") return unitManagementHref(type, unitId);
	return `${unitManagementHref(type, unitId)}/${sectionId}`;
}

export function parseUnitManagementSection(
	pathname: string,
	type: UnitType,
	unitId: string,
): UnitManagementSectionId | undefined {
	const base = unitManagementHref(type, unitId);
	if (pathname === base || pathname === `${base}/`) return "content";
	if (pathname === `${base}/metadata`) return "metadata";
	if (pathname === `${base}/relationships`) return "relationships";
	if (
		pathname === `${base}/content-structure` ||
		pathname.startsWith(`${base}/content-structure/`)
	)
		return "content-structure";
	if (pathname === `${base}/releases`) return "releases";
	if (pathname === `${base}/docks`) return "docks";
	if (pathname === `${base}/access`) return "access";
	if (pathname === `${base}/history` || pathname.startsWith(`${base}/history/`)) return "history";
	return undefined;
}

export function chapterEditorHref(bookId: string, chapterId: string): string {
	return `/units/book/${bookId}/chapters/${chapterId}/edit`;
}

export function chapterHistoryHref(bookId: string, chapterId: string): string {
	return `/units/book/${bookId}/chapters/${chapterId}/history`;
}

export function bookContentStructureHistoryHref(bookId: string): string {
	return `${unitManagementSectionHref("book", bookId, "content-structure")}/history`;
}
