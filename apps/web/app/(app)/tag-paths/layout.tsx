import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function TagPathsLayout({ children }: { readonly children: ReactNode }) {
	return <TranslationBoundary namespaces={["tags"]}>{children}</TranslationBoundary>;
}
