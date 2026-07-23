export const StaffSectionIds = ["members", "audit"] as const;

export type StaffSectionId = (typeof StaffSectionIds)[number];

export function isStaffSectionId(value: string): value is StaffSectionId {
	return StaffSectionIds.some((sectionId) => sectionId === value);
}
