import { notFound } from "next/navigation";

import { TagPathDetailPage } from "@/features/tags/pages/tag-path-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({ params }: { readonly params: Promise<{ path: string }> }) {
	const { path } = await params;
	if (!isUnitId(path)) notFound();
	return <TagPathDetailPage pathId={path} />;
}
