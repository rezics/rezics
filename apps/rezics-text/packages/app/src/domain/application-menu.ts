import type { RezicsTextMessages } from "../i18n/messages";

export const rezicsTextApplicationCommands = [
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

export type RezicsTextApplicationCommand = (typeof rezicsTextApplicationCommands)[number];

export function isRezicsTextApplicationCommand(
	value: unknown,
): value is RezicsTextApplicationCommand {
	return (
		typeof value === "string" && rezicsTextApplicationCommands.some((command) => command === value)
	);
}

export interface RezicsTextNativeMenuHost {
	readonly install: (options: {
		readonly messages: RezicsTextMessages;
		readonly onCommand: (command: RezicsTextApplicationCommand) => void;
	}) => Promise<() => void>;
}
