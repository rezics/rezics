import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["actions", "profiles"] as const;

export default function UserLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={Namespaces}>{children}</TranslationBoundary>;
}
