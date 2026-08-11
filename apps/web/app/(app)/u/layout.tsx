import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SlugProfileLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={["actions", "profiles"]}>{children}</TranslationBoundary>;
}
