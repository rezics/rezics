import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function UsersLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces="profiles">{children}</TranslationBoundary>;
}
