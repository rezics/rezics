import { isStaffSectionId, type StaffSectionId } from "../model/staff-section";

export const StaffOverviewHref = "/staff";

export function staffSectionHref(sectionId: StaffSectionId): string {
	return `${StaffOverviewHref}/${sectionId}`;
}

export function parseStaffSection(pathname: string): StaffSectionId | undefined {
	const match = /^\/staff\/([^/]+)\/?$/.exec(pathname);
	const value = match?.[1];
	return value && isStaffSectionId(value) ? value : undefined;
}
