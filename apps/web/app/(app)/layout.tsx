import type { ReactNode } from "react";

import { ApplicationShell } from "@/features/application-shell/application-shell";
import { AppShellTranslationNamespaces } from "@/i18n/namespaces";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function AppLayout({ children }: Readonly<{ children: ReactNode }>) {
	return (
		<TranslationBoundary namespaces={AppShellTranslationNamespaces}>
			<ApplicationShell>{children}</ApplicationShell>
		</TranslationBoundary>
	);
}
