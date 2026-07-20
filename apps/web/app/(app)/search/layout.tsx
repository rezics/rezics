import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["catalog", "engagement", "locale", "nav", "posts", "realms"] as const;

export default function SearchLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={Namespaces}>{children}</TranslationBoundary>;
}
