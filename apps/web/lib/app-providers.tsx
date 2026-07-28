"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useState, type ReactNode } from "react";
import type { TranslationSnapshot } from "native-i18n";
import type { resources } from "@rezics/i18n/resources";

import { AuthPortalProvider } from "@/features/auth/auth-portal";
import { AuthSessionProvider } from "@/features/auth/session-provider";
import { SessionCacheBoundary } from "@/features/auth/session-cache-boundary";
import type { InitialAuthSession } from "@/features/auth/server/initial-session.server";
import { TranslatedUiProvider } from "@/features/application-shell/components/ui-provider";
import { PwaLifecycle } from "@/features/pwa/pwa-lifecycle";
import { TranslationProvider } from "@/i18n/client";
import type { RootTranslationNamespaces } from "@/i18n/namespaces";
import { QueryClientDefaultOptions } from "@/lib/query-policy";
import { urlStateOptions } from "@/lib/search-params";

export function AppProviders({
	children,
	initialSession,
	initialTranslation,
}: {
	children: ReactNode;
	initialSession: InitialAuthSession;
	initialTranslation: TranslationSnapshot<typeof resources, typeof RootTranslationNamespaces>;
}) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: QueryClientDefaultOptions,
			}),
	);

	return (
		<NuqsAdapter defaultOptions={urlStateOptions}>
			<TranslationProvider initial={initialTranslation}>
				<TranslatedUiProvider>
					<AuthSessionProvider initialSession={initialSession}>
						<QueryClientProvider client={queryClient}>
							<SessionCacheBoundary>
								<AuthPortalProvider>{children}</AuthPortalProvider>
							</SessionCacheBoundary>
						</QueryClientProvider>
						<PwaLifecycle />
					</AuthSessionProvider>
				</TranslatedUiProvider>
			</TranslationProvider>
		</NuqsAdapter>
	);
}
