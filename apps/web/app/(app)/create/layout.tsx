import type { ReactNode } from "react";

import { StudioWorkspace } from "@/features/create/components/studio-workspace";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function CreateLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["create", "previewAccess", "tags"]}>
			<StudioWorkspace>{children}</StudioWorkspace>
		</TranslationBoundary>
	);
}
