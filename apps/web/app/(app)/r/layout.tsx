import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SlugRealmLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={["feed", "governance", "history", "media", "posts", "realms"]}
		>
			{children}
		</TranslationBoundary>
	);
}
