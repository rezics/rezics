"use client";

import { PostApiSearchByIndexIndex, postApiSearchByIndex } from "@rezics/openapi-tanstack-query";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { UiProvider, type EntitySearch } from "@rezics/ui";

import { authClient } from "@/lib/auth-client";
import { AuthPortalProvider } from "@/features/auth/auth-portal";
import { useTranslation, TranslationProvider } from "@/i18n/client";
import { shouldRetry } from "@/lib/query-policy";
import { urlStateOptions } from "@/lib/search-params";
import { getErrorText } from "@/i18n/errors";
import { PwaLifecycle } from "./pwa-lifecycle";

function isSearchIndex(index: string): index is PostApiSearchByIndexIndex {
	return Object.values(PostApiSearchByIndexIndex).some((candidate) => candidate === index);
}

const searchEntities: EntitySearch = async (index, query, signal) => {
	if (!isSearchIndex(index)) return [];
	const { data } = await postApiSearchByIndex({
		path: { index },
		body: { query, limit: 10 },
		signal,
	});
	return data.hits.map((hit) => ({
		id: hit.id,
		label: hit.titles[0] ?? hit.name ?? hit.slug ?? hit.id,
	}));
};

function TranslatedUiProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation({ suspense: true });

	return (
		<UiProvider
			errorMessage={(error) => getErrorText(t, error, t.state.error)}
			messages={{
				loading: t.state.loading,
				error: t.state.error,
				empty: t.state.empty,
				unnamed: t.ui.unnamed,
				retry: t.actions.retry,
				searchPlaceholder: t.search.placeholder,
				editor: {
					paragraph: t.editor.paragraph,
					heading2: t.editor.heading2,
					heading3: t.editor.heading3,
					quote: t.editor.quote,
					bold: t.editor.bold,
					italic: t.editor.italic,
					bulletList: t.editor.bulletList,
					numberedList: t.editor.numberedList,
					link: t.editor.link,
					linkPrompt: t.editor.linkPrompt,
					linkUrl: t.editor.linkUrl,
					openInNewTab: t.editor.openInNewTab,
					addLink: t.editor.addLink,
					removeLink: t.editor.removeLink,
					invalidLink: t.editor.invalidLink,
					undo: t.editor.undo,
					redo: t.editor.redo,
					style: t.editor.style,
					preview: t.editor.preview,
				},
			}}
			searchEntities={searchEntities}
		>
			{children}
		</UiProvider>
	);
}

function SessionCacheBoundary({ children }: { children: ReactNode }) {
	const { data: session, isPending } = authClient.useSession();
	const queryClient = useQueryClient();
	const identity = session?.user.id ?? null;
	const previous = useRef<string | null | undefined>(undefined);

	useEffect(() => {
		if (isPending) return;
		if (previous.current !== undefined && previous.current !== identity) queryClient.clear();
		previous.current = identity;
	}, [identity, isPending, queryClient]);

	return children;
}

export function AppProviders({
	children,
	localeTags,
}: {
	children: ReactNode;
	localeTags: readonly string[];
}) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: { queries: { staleTime: 30_000, retry: shouldRetry } },
			}),
	);

	return (
		<NuqsAdapter defaultOptions={urlStateOptions}>
			<TranslationProvider tags={localeTags}>
				<TranslatedUiProvider>
					<QueryClientProvider client={queryClient}>
						<SessionCacheBoundary>
							<AuthPortalProvider>{children}</AuthPortalProvider>
						</SessionCacheBoundary>
					</QueryClientProvider>
					<PwaLifecycle />
				</TranslatedUiProvider>
			</TranslationProvider>
		</NuqsAdapter>
	);
}
