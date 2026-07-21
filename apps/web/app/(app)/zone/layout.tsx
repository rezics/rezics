import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ZoneLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces="feed">{children}</TranslationBoundary>;
}
