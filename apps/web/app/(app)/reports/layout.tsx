import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ReportsLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={["reports"]}>{children}</TranslationBoundary>;
}
