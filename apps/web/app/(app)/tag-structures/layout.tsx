import type { ReactNode } from "react";

import { DevelopmentPreviewBoundary } from "@/features/preview-access/components/development-preview-boundary";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function TagStructuresLayout({ children }: { readonly children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["previewAccess", "tags"]}>
			<DevelopmentPreviewBoundary>{children}</DevelopmentPreviewBoundary>
		</TranslationBoundary>
	);
}
