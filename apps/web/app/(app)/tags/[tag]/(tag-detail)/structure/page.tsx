import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { TagStructurePage } from "@/features/tags/pages/tag-structure-page";

export default function Page() {
	return (
		<DevelopmentPreviewBoundary>
			<TagStructurePage />
		</DevelopmentPreviewBoundary>
	);
}
