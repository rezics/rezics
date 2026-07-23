import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function TagsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["catalog", "governance", "media"]}>
			{children}
		</TranslationBoundary>
	);
}
