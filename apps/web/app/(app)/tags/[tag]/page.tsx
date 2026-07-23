import { notFound } from "next/navigation";

import { TagDetailPage } from "@/features/tags/pages/tag-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({ params }: { readonly params: Promise<{ tag: string }> }) {
	const { tag } = await params;
	if (!isUnitId(tag)) notFound();
	return <TagDetailPage tagId={tag} />;
}
