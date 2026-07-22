import { UnitHistoryComparePage } from "@/features/units/pages/unit-history-compare-page";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const query = await searchParams;
	return <UnitHistoryComparePage from={query.from ?? null} to={query.to ?? null} />;
}
