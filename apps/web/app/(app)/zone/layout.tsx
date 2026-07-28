import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ZoneLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"engagement",
				"errors",
				"feed",
				"locale",
				"posts",
				"previewAccess",
				"realms",
				"search",
				"ui",
				"units",
				"zones",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
