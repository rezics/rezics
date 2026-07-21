import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { create } from "native-i18n";
import { useFixtureSelect } from "react-cosmos/client";
import { useEffect, useState, type ReactNode } from "react";

import { TranslatedUiProvider } from "@/features/application-shell/components/ui-provider";
import { TranslationProvider } from "@/i18n/client";
import { RootTranslationNamespaces } from "@/i18n/namespaces";
import { appThemeCss } from "@/lib/theme";

const CosmosTranslationNamespaces = [
	...RootTranslationNamespaces,
	"cover",
	"engagement",
	"feed",
	"posts",
] as const;

const i18n = create(resources, { timeZone: "Asia/Taipei" });
const [zhHantTranslation, englishTranslation] = await Promise.all([
	i18n.getTranslation(CosmosTranslationNamespaces, ["zh-Hant"]),
	i18n.getTranslation(CosmosTranslationNamespaces, ["en"]),
]);

export default function CosmosDecorator({ children }: { children: ReactNode }) {
	const [theme] = useFixtureSelect("Theme", {
		options: ["light", "dark"],
		defaultValue: "light",
	});
	const [locale] = useFixtureSelect("Locale", {
		options: ["zh-Hant", "en"],
		defaultValue: "zh-Hant",
	});
	const [queryClient] = useState(
		() => new QueryClient({ defaultOptions: { queries: { retry: false } } }),
	);

	useEffect(() => {
		document.documentElement.classList.toggle("dark", theme === "dark");
		document.documentElement.dataset.theme = theme;
		return () => {
			document.documentElement.classList.remove("dark");
			delete document.documentElement.dataset.theme;
		};
	}, [theme]);

	const initialTranslation =
		locale === "zh-Hant" ? zhHantTranslation.snapshot : englishTranslation.snapshot;

	return (
		<>
			<style>{appThemeCss}</style>
			<TranslationProvider initial={initialTranslation} key={locale}>
				<TranslatedUiProvider>
					<QueryClientProvider client={queryClient}>
						<main className="min-h-screen bg-background p-3 text-foreground sm:p-8">
							<div className="mx-auto w-full max-w-3xl min-w-0">{children}</div>
						</main>
					</QueryClientProvider>
				</TranslatedUiProvider>
			</TranslationProvider>
		</>
	);
}
