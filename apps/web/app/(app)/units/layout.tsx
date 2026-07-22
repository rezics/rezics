import type { ReactNode } from "react";

import { TranslationBoundary } from "@/i18n/translation-boundary";

const Namespaces = [
	"cover",
	"create",
	"engagement",
	"feed",
	"governance",
	"history",
	"licenses",
	"media",
	"posts",
	"units",
] as const;

export default function UnitsLayout({ children }: { children: ReactNode }) {
	return <TranslationBoundary namespaces={Namespaces}>{children}</TranslationBoundary>;
}
