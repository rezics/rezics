import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { TagPathPage } from "@/features/tags/pages/tag-structure-page";

export default function Page() {
	return (
		<DevelopmentPreviewBoundary>
			<TagPathPage />
		</DevelopmentPreviewBoundary>
	);
}
