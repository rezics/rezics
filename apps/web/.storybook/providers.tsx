import type { FixtureContentLanguage } from "@rezics/fixture-data";
import { resources } from "@rezics/i18n/resources";
import type { UiLocale } from "@rezics/i18n";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { create, type TranslationSnapshot } from "native-i18n";
import { useEffect, useState, type ReactNode } from "react";
import { fn } from "storybook/test";

import { TranslatedUiProvider } from "@/features/application-shell/components/ui-provider";
import { AuthPortalContext } from "@/features/auth/auth-portal-context";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { TranslationProvider } from "@/i18n/client";
import { BrowserContentLanguagesProvider } from "@/i18n/browser-content-languages";
import { RootTranslationNamespaces } from "@/i18n/namespaces";

const namespaces = [
	...RootTranslationNamespaces,
	"collections",
	"cover",
	"engagement",
	"entities",
	"feed",
	"governance",
	"locale",
	"media",
	"posts",
	"profiles",
	"realms",
	"reports",
	"settings",
	"tags",
	"units",
] as const;

const i18n = create(resources, { timeZone: "Asia/Taipei" });
const translations = new Map<
	UiLocale,
	Promise<TranslationSnapshot<typeof resources, typeof namespaces>>
>();

export function loadStoryTranslation(locale: UiLocale) {
	let translation = translations.get(locale);
	if (!translation) {
		translation = i18n.getTranslation(namespaces, [locale]).then(({ snapshot }) => snapshot);
		translations.set(locale, translation);
	}
	return translation;
}

export const openStoryAuthPortal = fn();

export function StoryProviders({
	children,
	contentLanguage,
	translation,
}: {
	children: ReactNode;
	contentLanguage: FixtureContentLanguage;
	translation: TranslationSnapshot<typeof resources, typeof namespaces>;
}) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: { retry: false, refetchOnWindowFocus: false },
					mutations: { retry: false },
				},
			}),
	);
	useEffect(() => () => queryClient.clear(), [queryClient]);

	return (
		<>
			<TranslationProvider initial={translation}>
				<BrowserContentLanguagesProvider languages={[contentLanguage]}>
					<QueryClientProvider client={queryClient}>
						<AuthSessionProvider initialSession={{ status: "resolved", data: null }}>
							<AuthPortalContext value={{ openAuthPortal: openStoryAuthPortal }}>
								<TranslatedUiProvider localizationLanguages={[contentLanguage]}>
									{children}
								</TranslatedUiProvider>
							</AuthPortalContext>
						</AuthSessionProvider>
					</QueryClientProvider>
				</BrowserContentLanguagesProvider>
			</TranslationProvider>
		</>
	);
}
