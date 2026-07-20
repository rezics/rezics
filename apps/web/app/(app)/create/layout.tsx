import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function CreateLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces="create">{children}</TranslationBoundary>;
}
