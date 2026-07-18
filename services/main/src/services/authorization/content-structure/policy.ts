export function isContentStructureNodeReadable(
	canEditBook: boolean,
	unitStatus: string | null,
	unitVisibility: string | null,
	contentStatus: string | null,
) {
	return (
		canEditBook ||
		(unitStatus?.toLowerCase() === "published" &&
			unitVisibility !== null &&
			["public", "unlisted"].includes(unitVisibility.toLowerCase()) &&
			contentStatus?.toLowerCase() === "published")
	);
}
