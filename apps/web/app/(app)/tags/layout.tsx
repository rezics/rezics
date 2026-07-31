import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function TagsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"actions",
				"collections",
				"editor",
				"engagement",
				"entities",
				"errors",
				"feed",
				"governance",
				"media",
				"locale",
				"notifications",
				"posts",
				"previewAccess",
				"reports",
				"search",
				"state",
				"tags",
				"ui",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
