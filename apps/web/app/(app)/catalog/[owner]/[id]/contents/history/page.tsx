import { notFound } from "next/navigation";
import { ContentStructureHistoryPage } from "@/features/history/pages/content-structure-history-page";

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const { owner, id } = await params;
	if (owner !== "publishing" && owner !== "program") notFound();
	return <ContentStructureHistoryPage owner={owner} unitId={id} />;
}
