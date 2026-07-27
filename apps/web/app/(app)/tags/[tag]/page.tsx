import { notFound } from "next/navigation";

import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { TagDetailPage } from "@/features/tags/pages/tag-detail-page";
import { isUnitId } from "@/features/units/model/unit-id";

export default async function Page({ params }: { readonly params: Promise<{ tag: string }> }) {
	const { tag } = await params;
	if (!isUnitId(tag)) notFound();
	return (
		<DevelopmentPreviewBoundary>
			<TagDetailPage tagId={tag} />
		</DevelopmentPreviewBoundary>
	);
}
