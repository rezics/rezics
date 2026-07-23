import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function NotificationsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["governance", "notifications"]}>
			{children}
		</TranslationBoundary>
	);
}
