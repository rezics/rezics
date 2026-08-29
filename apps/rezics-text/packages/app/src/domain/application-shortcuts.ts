import type { RezicsTextApplicationCommand } from "./application-menu";

interface RezicsTextApplicationShortcutDefinition {
	readonly command: RezicsTextApplicationCommand;
	readonly key: string;
	readonly shiftKey?: boolean;
}

const rezicsTextApplicationShortcutDefinitions: readonly RezicsTextApplicationShortcutDefinition[] =
	[
		{ command: "new-document", key: "n" },
		{ command: "open", key: "o" },
		{ command: "save", key: "s" },
		{ command: "save-as", key: "s", shiftKey: true },
		{ command: "close", key: "w" },
		{ command: "toggle-sidebar", key: "l", shiftKey: true },
		{ command: "preferences", key: "," },
	];

export interface RezicsTextShortcutEvent {
	readonly altKey: boolean;
	readonly ctrlKey: boolean;
	readonly defaultPrevented: boolean;
	readonly isComposing: boolean;
	readonly key: string;
	readonly metaKey: boolean;
	readonly repeat: boolean;
	readonly shiftKey: boolean;
}

export function applicationCommandFromShortcut(
	event: RezicsTextShortcutEvent,
): RezicsTextApplicationCommand | undefined {
	if (
		event.defaultPrevented ||
		event.isComposing ||
		event.repeat ||
		event.altKey ||
		event.ctrlKey === event.metaKey
	)
		return undefined;

	const key = event.key.toLocaleLowerCase("en-US");
	return rezicsTextApplicationShortcutDefinitions.find(
		(shortcut) => shortcut.key === key && Boolean(shortcut.shiftKey) === event.shiftKey,
	)?.command;
}

export function applicationCommandAccelerator(
	command: RezicsTextApplicationCommand,
): string | undefined {
	const shortcut = rezicsTextApplicationShortcutDefinitions.find(
		(definition) => definition.command === command,
	);
	if (!shortcut) return undefined;
	return `CmdOrCtrl+${shortcut.shiftKey ? "Shift+" : ""}${shortcut.key.toUpperCase()}`;
}

export function applicationCommandShortcutLabel(
	command: RezicsTextApplicationCommand,
	usesCommandModifier: boolean,
): string | undefined {
	const shortcut = rezicsTextApplicationShortcutDefinitions.find(
		(definition) => definition.command === command,
	);
	if (!shortcut) return undefined;
	const key = shortcut.key.toUpperCase();
	if (usesCommandModifier) return `${shortcut.shiftKey ? "⇧" : ""}⌘${key}`;
	return `Ctrl+${shortcut.shiftKey ? "Shift+" : ""}${key}`;
}

export function platformUsesCommandModifier(platform: string | undefined): boolean {
	return platform !== undefined && /Mac|iPhone|iPad/u.test(platform);
}
