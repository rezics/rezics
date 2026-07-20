import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["cover", "engagement"] as const;

export default function CollectionsLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={Namespaces}>{children}</TranslationBoundary>;
}
