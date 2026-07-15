"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

export interface UiMessages {
	loading: ReactNode;
	error: ReactNode;
	empty: ReactNode;
	unnamed: ReactNode;
	retry: ReactNode;
	searchPlaceholder: string;
	editor: {
		paragraph: ReactNode;
		heading2: ReactNode;
		heading3: ReactNode;
		quote: ReactNode;
		bold: ReactNode;
		italic: ReactNode;
		bulletList: ReactNode;
		numberedList: ReactNode;
		link: ReactNode;
		linkPrompt: string;
	};
}

export type UiMessagesInput = Omit<Partial<UiMessages>, "editor"> & {
	editor?: Partial<UiMessages["editor"]>;
};

export interface EntityPickerHit {
	id: string;
	label: string;
}

export type EntitySearch = (
	index: string,
	query: string,
	signal: AbortSignal,
) => Promise<readonly EntityPickerHit[]>;

interface UiContextValue {
	messages: UiMessages;
	searchEntities?: EntitySearch;
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
	},
} satisfies UiMessages;

const UiContext = createContext<UiContextValue>({
	messages: DefaultMessages,
});

export function UiProvider({
	children,
	messages,
	searchEntities,
	errorMessage,
}: {
	children: ReactNode;
	messages?: UiMessagesInput;
	searchEntities?: EntitySearch;
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
			errorMessage,
		}),
		[errorMessage, messages, searchEntities],
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
