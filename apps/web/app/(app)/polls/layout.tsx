import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function PollsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["engagement", "posts"]}>{children}</TranslationBoundary>
	);
}
