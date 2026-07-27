import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function RealmLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={[
				"engagement",
				"feed",
				"governance",
				"history",
				"media",
				"posts",
				"realms",
				"units",
			]}
		>
			{children}
		</TranslationBoundary>
	);
}
