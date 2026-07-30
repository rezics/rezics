"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { PresentedAvatar } from "@rezics/avatar";

export interface UiMessages {
	loading: ReactNode;
	error: ReactNode;
	empty: ReactNode;
	unnamed: ReactNode;
	retry: ReactNode;
	searchPlaceholder: string;
	editor: {
		paragraph: string;
		heading2: string;
		heading3: string;
		quote: string;
		bold: string;
		italic: string;
		bulletList: string;
		numberedList: string;
		link: string;
		linkPrompt: string;
		linkUrl: string;
		openInNewTab: string;
		addLink: string;
		removeLink: string;
		invalidLink: string;
		undo: string;
		redo: string;
		style: string;
		preview: string;
		placeholder: string;
		slashMenu: string;
		slashHint: string;
		mentionSearchPrompt: string;
		mentionUsers: string;
		mentionTags: string;
		mentionEntities: string;
		mentionRealms: string;
		mentionZones: string;
		unavailableMention: string;
		richText: string;
		toolbar: string;
	};
}

export type UiMessagesInput = Omit<Partial<UiMessages>, "editor"> & {
	editor?: Partial<UiMessages["editor"]>;
};

export interface EntityPickerHit {
	id: string;
	label: string;
	kind?: string;
	avatar?: PresentedAvatar | null;
}

export interface UnitMentionPresentation extends EntityPickerHit {
	kind: string;
}

export interface EntitySearchOptions {
	readonly kinds?: readonly string[];
}

export type EntitySearch = (
	index: string,
	query: string,
	signal: AbortSignal,
	options?: EntitySearchOptions,
) => Promise<readonly EntityPickerHit[]>;
export type UnitMentionResolver = (
	unitIds: readonly string[],
	signal: AbortSignal,
) => Promise<readonly UnitMentionPresentation[]>;

interface UiContextValue {
	messages: UiMessages;
	searchEntities?: EntitySearch;
	resolveUnitMentions?: UnitMentionResolver;
	errorMessage?: (error: unknown) => ReactNode;
}

const DefaultMessages = {
	loading: "Loading…",
	error: "Something went wrong.",
	empty: "No results.",
	unnamed: "Unnamed",
	retry: "Retry",
	searchPlaceholder: "Search…",
	editor: {
		paragraph: "Paragraph",
		heading2: "Heading 2",
		heading3: "Heading 3",
		quote: "Quote",
		bold: "Bold",
		italic: "Italic",
		bulletList: "Bulleted list",
		numberedList: "Numbered list",
		link: "Link",
		linkPrompt: "Enter a URL",
		linkUrl: "URL",
		openInNewTab: "Open in a new tab",
		addLink: "Add link",
		removeLink: "Remove link",
		invalidLink: "Enter a supported URL.",
		undo: "Undo",
		redo: "Redo",
		style: "Text style",
		preview: "Preview",
		placeholder: "Write something, or type / for blocks.",
		slashMenu: "Insert",
		slashHint: "Use / for blocks or u/, t/, e/, r/, z/ for Unit mentions.",
		mentionSearchPrompt: "Type to search.",
		mentionUsers: "Users",
		mentionTags: "Tags",
		mentionEntities: "Entities",
		mentionRealms: "Realms",
		mentionZones: "Zones",
		unavailableMention: "Unavailable Unit",
		richText: "Rich text",
		toolbar: "Formatting toolbar",
	},
} satisfies UiMessages;

const UiContext = createContext<UiContextValue>({
	messages: DefaultMessages,
});

export function UiProvider({
	children,
	messages,
	searchEntities,
	resolveUnitMentions,
	errorMessage,
}: {
	children: ReactNode;
	messages?: UiMessagesInput;
	searchEntities?: EntitySearch;
	resolveUnitMentions?: UnitMentionResolver;
	errorMessage?: (error: unknown) => ReactNode;
}) {
	const value = useMemo<UiContextValue>(
		() => ({
			messages: {
				...DefaultMessages,
				...messages,
				editor: { ...DefaultMessages.editor, ...messages?.editor },
			},
			searchEntities,
			resolveUnitMentions,
			errorMessage,
		}),
		[errorMessage, messages, resolveUnitMentions, searchEntities],
	);

	return <UiContext.Provider value={value}>{children}</UiContext.Provider>;
}

export function useUiMessages() {
	return useContext(UiContext).messages;
}

export function useUiErrorMessage() {
	return useContext(UiContext).errorMessage;
}

export function useEntitySearch() {
	return useContext(UiContext).searchEntities;
}

export function useUnitMentionResolver() {
	return useContext(UiContext).resolveUnitMentions;
}
