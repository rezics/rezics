import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function RealmsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["feed", "history", "media", "posts", "realms"]}>
			{children}
		</TranslationBoundary>
	);
}
