import type { ReactNode } from "react";

import { PreviewCapabilityBoundary } from "@/features/development/components/preview-capability-boundary";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function SlugZoneLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["development", "ui", "zones"]}>
			<PreviewCapabilityBoundary capability="unit.zone.preview">
				{children}
			</PreviewCapabilityBoundary>
		</TranslationBoundary>
	);
}
