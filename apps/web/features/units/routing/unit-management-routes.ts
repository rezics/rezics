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
	return `${unitManagementHref(type, unitId)}/${sectionId}`;
}

export function parseUnitManagementSection(
	pathname: string,
	type: UnitType,
	unitId: string,
): UnitManagementSectionId | undefined {
	const base = unitManagementHref(type, unitId);
	if (pathname === base || pathname === `${base}/`) return undefined;
	if (pathname === `${base}/content`) return "content";
	if (pathname === `${base}/metadata`) return "metadata";
	if (pathname === `${base}/tags`) return "tags";
	if (pathname === `${base}/realms`) return "realms";
	if (pathname === `${base}/access`) return "access";
	if (pathname === `${base}/history` || pathname.startsWith(`${base}/history/`)) return "history";
	return undefined;
}

export function chapterEditorHref(_bookId: string, chapterId: string): string {
	return `/posts/${chapterId}/edit`;
}

export function chapterHistoryHref(_bookId: string, chapterId: string): string {
	return `/posts/${chapterId}/history`;
}

export function bookContentStructureHistoryHref(bookId: string): string {
	return contentStructureHistoryHref("publishing", bookId);
}

export function contentStructureHistoryHref(
	type: "publishing" | "program",
	unitId: string,
): string {
	return `/catalog/${type}/${unitId}/contents/history`;
}
