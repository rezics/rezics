import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function EntitiesLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"actions",
				"entities",
				"create",
				"errors",
				"feed",
				"governance",
				"locale",
				"media",
				"reports",
				"state",
				"search",
				"ui",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
