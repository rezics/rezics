import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function MessagesLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={["messages"]}>{children}</TranslationBoundary>;
}
