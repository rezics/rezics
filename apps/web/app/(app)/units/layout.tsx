import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function UnitsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"cover",
				"create",
				"engagement",
				"feed",
				"governance",
				"history",
				"licenses",
				"media",
				"posts",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
