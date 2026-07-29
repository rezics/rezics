export const MyReportsHref = "/reports";
const ReportIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function myReportAnchorId(reportId: string): string {
	return `report-${reportId}`;
}

export function myReportHref(reportId: string): string {
	return `${MyReportsHref}?reportId=${encodeURIComponent(reportId)}#${encodeURIComponent(myReportAnchorId(reportId))}`;
}

export function parseSelectedReportId(
	value: string | readonly string[] | undefined,
): string | undefined {
	return typeof value === "string" && ReportIdPattern.test(value) ? value : undefined;
}
