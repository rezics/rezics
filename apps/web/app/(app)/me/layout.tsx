import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function MeLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["cover", "engagement", "nav", "profiles"]}>
			{children}
		</TranslationBoundary>
	);
}
