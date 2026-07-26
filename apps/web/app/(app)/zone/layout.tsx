import type { ReactNode } from "react";

import { PreviewCapabilityBoundary } from "@/features/development/components/preview-capability-boundary";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function ZoneLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary
			namespaces={["development", "errors", "locale", "search", "ui", "zones"]}
		>
			<PreviewCapabilityBoundary capability="unit.zone.preview">
				{children}
			</PreviewCapabilityBoundary>
		</TranslationBoundary>
	);
}
