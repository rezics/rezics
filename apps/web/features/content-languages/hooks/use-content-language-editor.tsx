"use client";

import { isContentLanguage, toContentLanguage, type ContentLanguage } from "@rezics/i18n";
import { usePathname, useSearchParams } from "next/navigation";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useState,
	type ReactNode,
} from "react";

import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useTranslation } from "@/i18n/client";
import {
	parseContentLanguageOrder,
	type ContentLanguageOrder,
} from "../model/content-language-order";

interface ContentLanguageEditorContextValue {
	readonly unitId: string;
	readonly languages: ContentLanguageOrder;
	readonly selectedLanguage: ContentLanguage;
	readonly selectedLanguageIsPending: boolean;
	readonly dirty: boolean;
	readonly requestLanguage: (language: ContentLanguage) => boolean;
	readonly replaceLanguage: (language: ContentLanguage) => void;
	readonly setDirty: (dirty: boolean) => void;
	readonly languagesChanged: () => Promise<void>;
}

const ContentLanguageEditorContext = createContext<ContentLanguageEditorContextValue | undefined>(
	undefined,
);

export function ContentLanguageEditorProvider({
	unitId,
	localizations,
	onLanguagesChanged,
	children,
}: {
	readonly unitId: string;
	readonly localizations: readonly { readonly language: ContentLanguage }[];
	readonly onLanguagesChanged: () => void | Promise<void>;
	readonly children: ReactNode;
}) {
	const { t, locale } = useTranslation(["units"]);
	const router = useApplicationRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [dirty, setDirty] = useState(false);
	useEffect(() => {
		if (!dirty) return;
		const warnBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", warnBeforeUnload);
		return () => window.removeEventListener("beforeunload", warnBeforeUnload);
	}, [dirty]);
	const languages = useMemo(() => {
		const parsed = parseContentLanguageOrder(localizations.map(({ language }) => language));
		if (!parsed) throw new Error("A Unit editor requires at least one unique content language");
		return parsed;
	}, [localizations]);
	const requestedLanguage = searchParams.get("language");
	const interfaceLanguage = toContentLanguage(locale.target);
	const selectedLanguage =
		requestedLanguage && isContentLanguage(requestedLanguage)
			? requestedLanguage
			: languages.includes(interfaceLanguage)
				? interfaceLanguage
				: languages[0];

	const writeLanguage = useCallback(
		(language: ContentLanguage) => {
			const next = new URLSearchParams(searchParams.toString());
			next.set("language", language);
			router.replace(`${pathname}?${next.toString()}`, { scroll: false });
		},
		[pathname, router, searchParams],
	);
	const requestLanguage = useCallback(
		(language: ContentLanguage) => {
			if (language === selectedLanguage) return true;
			if (dirty && !window.confirm(t.units.contentLanguages.unsavedConfirm)) return false;
			setDirty(false);
			writeLanguage(language);
			return true;
		},
		[dirty, selectedLanguage, t.units.contentLanguages.unsavedConfirm, writeLanguage],
	);
	const replaceLanguage = useCallback(
		(language: ContentLanguage) => {
			setDirty(false);
			writeLanguage(language);
		},
		[writeLanguage],
	);
	const languagesChanged = useCallback(async () => {
		await onLanguagesChanged();
	}, [onLanguagesChanged]);
	const value = useMemo<ContentLanguageEditorContextValue>(
		() => ({
			unitId,
			languages,
			selectedLanguage,
			selectedLanguageIsPending: !languages.includes(selectedLanguage),
			dirty,
			requestLanguage,
			replaceLanguage,
			setDirty,
			languagesChanged,
		}),
		[
			dirty,
			languages,
			languagesChanged,
			replaceLanguage,
			requestLanguage,
			selectedLanguage,
			unitId,
		],
	);
	return (
		<ContentLanguageEditorContext.Provider value={value}>
			{children}
		</ContentLanguageEditorContext.Provider>
	);
}

export function useContentLanguageEditor(): ContentLanguageEditorContextValue {
	const value = useContext(ContentLanguageEditorContext);
	if (!value)
		throw new Error("Content language controls require a ContentLanguageEditorProvider");
	return value;
}
