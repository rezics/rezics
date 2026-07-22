import type { ReactNode } from "react";

import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = ["feed", "governance", "locale", "media", "settings"] as const;

export default function SettingsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={Namespaces}>
			<SettingsWorkspace>{children}</SettingsWorkspace>
		</TranslationBoundary>
	);
}
