import { CollectionHistoryComparePage } from "@/features/collections/pages/collection-history-compare-page";

export default async function Page({
	searchParams,
}: {
	readonly searchParams: Promise<{ from?: string; stream?: string; to?: string }>;
}) {
	const { from, stream, to } = await searchParams;
	return (
		<CollectionHistoryComparePage
			from={from ?? null}
			stream={stream === "items" ? "items" : "details"}
			to={to ?? null}
		/>
	);
}
