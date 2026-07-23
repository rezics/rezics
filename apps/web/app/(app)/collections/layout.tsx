import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function CollectionsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["cover", "engagement"]}>{children}</TranslationBoundary>
	);
}
