import type { ReactNode } from "react";

import { StaffWorkspace } from "@/features/staff/components/staff-workspace";
import { TranslationBoundary } from "@/i18n/translation-boundary";

export default function StaffLayout({ children }: { children: ReactNode }) {
	return (
		<TranslationBoundary namespaces={["governance", "staff"]}>
			<StaffWorkspace>{children}</StaffWorkspace>
		</TranslationBoundary>
	);
}
