import { MyReportsPage } from "@/features/reports/pages/my-reports-page";
import { parseSelectedReportId } from "@/features/reports/routing/report-routes";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ reportId?: string | string[] }>;
}) {
	const { reportId } = await searchParams;
	return <MyReportsPage selectedReportId={parseSelectedReportId(reportId)} />;
}
