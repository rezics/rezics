import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function EntitiesLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["catalog", "create", "governance", "media"]}>
			{children}
		</TranslationBoundary>
	);
}
