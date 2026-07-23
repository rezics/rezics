import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function TagStructuresLayout({ children }: { readonly children: ReactNode }) {
	return <TranslationBoundary namespaces={["tags"]}>{children}</TranslationBoundary>;
}
