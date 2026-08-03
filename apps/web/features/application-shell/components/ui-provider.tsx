"use client";

import type { ContentLanguage } from "@rezics/i18n";
import { useMemo, type ReactNode } from "react";

import { UiProvider } from "@rezics/ui";

import { createEntitySearch } from "@/features/search/search-entities";
import { createUnitMentionResolver } from "@/features/editor/resolve-unit-mentions";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";

// ```progress
// id: feedback.toast-audit
// status: open
// goal: Apply one accessible localized feedback policy to user-triggered mutations across the web application.
// depends: []
// accept:
//   - A maintained action inventory identifies when inline state, a toast, or no additional message is the appropriate success and failure feedback.
//   - Create, publish, save, remove, moderation, and destructive actions follow the inventory without duplicate or contradictory messages.
//   - Toast timing, focus behavior, live-region semantics, dismissal, and overlapping mutations are accessible.
//   - Every visible message is owned by typed localization resources and uses shared UI infrastructure.
// verify:
//   - Exercise representative success, failure, retry, cancellation, navigation, and overlapping-mutation cases in non-rendering component tests.
//   - Run the web localization policy check, typecheck, and affected feature tests.
//   - Have a maintainer perform frontend acceptance for the representative actions.
// ```
export function ApplicationUiProvider({ children }: Readonly<{ children: ReactNode }>) {
	const localizationLanguages = useLocalizationLanguages();

	return (
		<TranslatedUiProvider localizationLanguages={localizationLanguages}>
			{children}
		</TranslatedUiProvider>
	);
}

export function TranslatedUiProvider({
	children,
	localizationLanguages,
}: Readonly<{
	children: ReactNode;
	localizationLanguages: readonly ContentLanguage[];
}>) {
	const { t } = useTranslation([
		"actions",
		"betterAuthErrorCodes",
		"editor",
		"errorCodes",
		"errors",
		"state",
		"ui",
	]);
	const searchEntities = useMemo(
		() => createEntitySearch(localizationLanguages),
		[localizationLanguages],
	);
	const resolveUnitMentions = useMemo(
		() => createUnitMentionResolver(localizationLanguages),
		[localizationLanguages],
	);

	return (
		<UiProvider
			errorMessage={(error) => getErrorText(t, error, t.state.error)}
			messages={{
				loading: t.state.loading,
				error: t.state.error,
				empty: t.state.empty,
				unnamed: t.ui.unnamed,
				retry: t.actions.retry,
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
					placeholder: t.editor.placeholder,
					slashMenu: t.editor.slashMenu,
					slashHint: t.editor.slashHint,
					mentionSearchPrompt: t.editor.mentionSearchPrompt,
					mentionUsers: t.editor.mentionUsers,
					mentionTags: t.editor.mentionTags,
					mentionEntities: t.editor.mentionEntities,
					mentionRealms: t.editor.mentionRealms,
					mentionZones: t.editor.mentionZones,
					unavailableMention: t.editor.unavailableMention,
					richText: t.editor.richText,
					toolbar: t.editor.toolbar,
				},
			}}
			searchEntities={searchEntities}
			resolveUnitMentions={resolveUnitMentions}
		>
			{children}
		</UiProvider>
	);
}
