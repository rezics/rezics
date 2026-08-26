export const ZoneManagementSectionIds = [
	"overview",
	"pages",
	"search",
	"navigation",
	"layout",
	"theme",
] as const;
export type ZoneManagementSectionId = (typeof ZoneManagementSectionIds)[number];

export function zoneManagementHref(zoneId: string): string {
	return `/zone/${zoneId}/manage`;
}

export function zoneManagementSectionHref(
	zoneId: string,
	section: ZoneManagementSectionId,
): string {
	return section === "overview"
		? zoneManagementHref(zoneId)
		: `${zoneManagementHref(zoneId)}/${section}`;
}

export function parseZoneManagementSection(
	pathname: string,
	zoneId: string,
): ZoneManagementSectionId {
	const base = zoneManagementHref(zoneId);
	const segment = pathname.slice(base.length + 1).split("/")[0];
	return ZoneManagementSectionIds.find((candidate) => candidate === segment) ?? "overview";
}
