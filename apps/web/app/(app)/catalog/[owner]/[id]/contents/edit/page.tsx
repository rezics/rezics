import { notFound } from "next/navigation";
import { ContentStructurePage } from "@/features/units/pages/content-structure-page";

export default async function Page({ params }: { params: Promise<{ owner: string; id: string }> }) {
	const { owner, id } = await params;
	if (owner !== "publishing" && owner !== "program") notFound();
	return <ContentStructurePage owner={owner} unitId={id} />;
}
