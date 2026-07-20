import type { ReactNode } from "react";
import type { NamespaceSelection } from "native-i18n";
import type { resources } from "@rezics/i18n/resources";

import { TranslationProvider } from "./client";
import { getTranslation } from "./server";

export async function TranslationBoundary<
	const Selection extends NamespaceSelection<typeof resources>,
>({ children, namespaces }: { children: ReactNode; namespaces: Selection }) {
	const { snapshot } = await getTranslation(namespaces);
	return <TranslationProvider initial={snapshot}>{children}</TranslationProvider>;
}
