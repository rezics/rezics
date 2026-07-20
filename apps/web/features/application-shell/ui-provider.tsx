"use client";

import type { ReactNode } from "react";

import { UiProvider } from "@rezics/ui";

import { searchEntities } from "@/features/search/search-entities";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";

export function TranslatedUiProvider({ children }: { children: ReactNode }) {
	const { t } = useTranslation([
		"actions",
		"betterAuthErrorCodes",
		"editor",
		"errorCodes",
		"errors",
		"search",
		"state",
		"ui",
	]);

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
