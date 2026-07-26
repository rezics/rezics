import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SlugZoneLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={["ui", "zones"]}>{children}</TranslationBoundary>;
}
