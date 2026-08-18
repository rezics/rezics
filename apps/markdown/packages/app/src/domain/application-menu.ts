import type { MarkdownEditorMessages } from "../i18n/messages";

export const markdownApplicationCommands = [
	"new-document",
	"new-folder",
	"open",
	"save",
	"save-as",
	"close",
	"close-all",
	"toggle-sidebar",
	"source",
	"preview",
	"about",
	"preferences",
] as const;

export type MarkdownApplicationCommand = (typeof markdownApplicationCommands)[number];

export function isMarkdownApplicationCommand(value: unknown): value is MarkdownApplicationCommand {
	return (
		typeof value === "string" && markdownApplicationCommands.some((command) => command === value)
	);
}

export interface MarkdownNativeMenuHost {
	readonly install: (options: {
		readonly messages: MarkdownEditorMessages;
		readonly onCommand: (command: MarkdownApplicationCommand) => void;
	}) => Promise<() => void>;
}
