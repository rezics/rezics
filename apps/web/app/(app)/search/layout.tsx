import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SearchLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={["catalog", "engagement", "locale", "nav", "posts", "realms"]}
		>
			{children}
		</TranslationBoundary>
	);
}
