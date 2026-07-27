import { CollectionHistoryComparePage } from "@/features/collections/pages/collection-history-compare-page";

export default async function Page({
	searchParams,
}: {
	readonly searchParams: Promise<{ from?: string; to?: string }>;
}) {
	const { from, to } = await searchParams;
	return <CollectionHistoryComparePage from={from ?? null} to={to ?? null} />;
}
