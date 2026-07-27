import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ZonesLayout({ children }: { readonly children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["previewAccess", "search", "zones"]}>
			{children}
		</TranslationBoundary>
	);
}
