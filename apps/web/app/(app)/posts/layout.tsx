import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function PostsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["feed", "history", "posts"]}>
			{children}
		</TranslationBoundary>
	);
}
