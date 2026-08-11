import { resources } from "@rezics/i18n/resources";
import { UiLocaleValues, type UiLocale } from "@rezics/i18n";
import { FixtureProvider } from "@rezics/fixture-client";
import { FixtureContentLanguages, type FixtureContentLanguage } from "@rezics/fixture-data";
import { appThemeCss } from "@rezics/ui/theme";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { create } from "native-i18n";
import { useFixtureSelect } from "react-cosmos/client";
import { useEffect, useMemo, useState, type ReactNode } from "react";

import { TranslatedUiProvider } from "@/features/application-shell/components/ui-provider";
import { TranslationProvider } from "@/i18n/client";
import { RootTranslationNamespaces } from "@/i18n/namespaces";

const CosmosTranslationNamespaces = [
	...RootTranslationNamespaces,
	"cover",
	"engagement",
	"feed",
	"media",
	"posts",
] as const;

const i18n = create(resources, { timeZone: "Asia/Taipei" });
const translations = new Map(
	await Promise.all(
		UiLocaleValues.map(
			async (locale) =>
				[
					locale,
					(await i18n.getTranslation(CosmosTranslationNamespaces, [locale])).snapshot,
				] as const,
		),
	),
);

export default function CosmosDecorator({ children }: { children: ReactNode }) {
	const [theme] = useFixtureSelect("Theme", {
		options: ["light", "dark"],
		defaultValue: "light",
	});
	const [locale] = useFixtureSelect<UiLocale>("Locale", {
		options: [...UiLocaleValues],
		defaultValue: "zh-Hant",
	});
	const [contentLanguage] = useFixtureSelect<FixtureContentLanguage>("Content language", {
		options: [...FixtureContentLanguages],
		defaultValue: "zh",
	});
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	);
	const localizationLanguages = useMemo(() => [contentLanguage], [contentLanguage]);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.dataset.theme = theme;
		return () => {
			document.documentElement.classList.remove("dark");
			delete document.documentElement.dataset.theme;
		};
	}, [theme]);

	const initialTranslation = translations.get(locale);
	if (!initialTranslation) throw new Error(`Missing Cosmos translation for ${locale}`);

	return (
		<>
			<style>{appThemeCss}</style>
			<TranslationProvider initial={initialTranslation} key={locale}>
				<FixtureProvider contentLanguage={contentLanguage}>
					<QueryClientProvider client={queryClient}>
						<TranslatedUiProvider localizationLanguages={localizationLanguages}>
							<main className="min-h-screen bg-background p-3 text-foreground sm:p-8">
								<div className="mx-auto w-full max-w-3xl min-w-0">{children}</div>
							</main>
						</TranslatedUiProvider>
					</QueryClientProvider>
				</FixtureProvider>
			</TranslationProvider>
		</>
	);
}
