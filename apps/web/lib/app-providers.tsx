"use client";

import type { DehydratedState } from "@tanstack/react-query";
import { Toaster } from "@rezics/ui";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";
import type { TranslationSnapshot } from "native-i18n";
import type { resources } from "@rezics/i18n/resources";
import type { ContentLanguage } from "@rezics/i18n";

import { AuthPortalProvider } from "@/features/auth/auth-portal";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { SessionQueryClientBoundary } from "@/features/auth/session-query-client-boundary";
import type { InitialAuthSession } from "@/features/auth/server/initial-session.server";
import { NavigationProgressProvider } from "@/features/application-shell/navigation-progress";
import { ApplicationUiProvider } from "@/features/application-shell/components/ui-provider";
import { PwaLifecycle } from "@/features/pwa/pwa-lifecycle";
import { BrowserContentLanguagesProvider } from "@/i18n/browser-content-languages";
import { TranslationProvider } from "@/i18n/client";
import type { RootTranslationNamespaces } from "@/i18n/namespaces";
import { urlStateOptions } from "@/lib/search-params";

export function AppProviders({
	browserContentLanguages,
	children,
	dehydratedState,
	initialSession,
	initialTranslation,
	turnstileSiteKey,
}: {
	browserContentLanguages: readonly ContentLanguage[];
	children: ReactNode;
	dehydratedState: DehydratedState;
	initialSession: InitialAuthSession;
	initialTranslation: TranslationSnapshot<typeof resources, typeof RootTranslationNamespaces>;
	turnstileSiteKey: string;
}) {
	return (
		<NuqsAdapter defaultOptions={urlStateOptions}>
			<TranslationProvider initial={initialTranslation}>
				<BrowserContentLanguagesProvider languages={browserContentLanguages}>
					<NavigationProgressProvider>
						<AuthSessionProvider initialSession={initialSession}>
							<SessionQueryClientBoundary
								dehydratedState={dehydratedState}
								initialSession={initialSession}
							>
								<ApplicationUiProvider>
									<AuthPortalProvider turnstileSiteKey={turnstileSiteKey}>
										{children}
										<Toaster />
									</AuthPortalProvider>
								</ApplicationUiProvider>
							</SessionQueryClientBoundary>
							<PwaLifecycle />
						</AuthSessionProvider>
					</NavigationProgressProvider>
				</BrowserContentLanguagesProvider>
			</TranslationProvider>
		</NuqsAdapter>
	);
}
