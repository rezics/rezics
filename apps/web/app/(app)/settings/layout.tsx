import type { ReactNode } from "react";

import { SettingsWorkspace } from "@/features/settings/components/settings-workspace";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SettingsLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={["feed", "governance", "licenses", "locale", "media", "settings", "tags"]}
		>
			<SettingsWorkspace>{children}</SettingsWorkspace>
		</TranslationBoundary>
	);
}
