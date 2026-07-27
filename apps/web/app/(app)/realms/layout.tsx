import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function RealmsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"engagement",
				"feed",
				"history",
				"media",
				"posts",
				"previewAccess",
				"realms",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
