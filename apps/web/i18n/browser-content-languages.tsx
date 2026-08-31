"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { createContext, useContext, type ReactNode } from "react";

const NoBrowserContentLanguages: readonly ContentLanguage[] = [];
const BrowserContentLanguagesContext = createContext(NoBrowserContentLanguages);

export function BrowserContentLanguagesProvider({
	children,
	languages,
}: {
	readonly children: ReactNode;
	readonly languages: readonly ContentLanguage[];
}) {
	return (
		<BrowserContentLanguagesContext value={languages}>{children}</BrowserContentLanguagesContext>
	);
}

export function useBrowserContentLanguages(): readonly ContentLanguage[] {
	return useContext(BrowserContentLanguagesContext);
}
