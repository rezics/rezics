import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function CollectionsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"actions",
				"collections",
				"cover",
				"errors",
				"feed",
				"governance",
				"history",
				"posts",
				"realms",
				"state",
				"ui",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
