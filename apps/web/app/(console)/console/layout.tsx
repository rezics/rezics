import type { ReactNode } from "react";

import { ConsoleWorkspace } from "@/features/console/components/console-workspace";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ConsoleLayout({ children }: { readonly children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={["console", "errors", "governance", "realms", "reports", "ui"]}
		>
			<ConsoleWorkspace>{children}</ConsoleWorkspace>
		</TranslationBoundary>
	);
}
