import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["feed", "media", "posts", "realms"] as const;

export default function RealmLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={Namespaces}>{children}</TranslationBoundary>;
}
