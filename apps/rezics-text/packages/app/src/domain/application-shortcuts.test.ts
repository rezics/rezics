import { describe, expect, it } from "vitest";
import {
	applicationCommandAccelerator,
	applicationCommandFromShortcut,
	applicationCommandShortcutLabel,
	platformUsesCommandModifier,
	type RezicsTextShortcutEvent,
} from "./application-shortcuts";

function shortcutEvent(overrides: Partial<RezicsTextShortcutEvent>): RezicsTextShortcutEvent {
	return {
		altKey: false,
		ctrlKey: true,
		defaultPrevented: false,
		isComposing: false,
		key: "",
		metaKey: false,
		repeat: false,
		shiftKey: false,
		...overrides,
	};
}

describe("application shortcuts", () => {
	it("reserves Ctrl+B and Command+B for the Markdown editor", () => {
		expect(applicationCommandFromShortcut(shortcutEvent({ key: "b" }))).toBeUndefined();
		expect(
			applicationCommandFromShortcut(shortcutEvent({ ctrlKey: false, key: "b", metaKey: true })),
		).toBeUndefined();
	});

	it("toggles the sidebar with the shifted L shortcut", () => {
		expect(applicationCommandFromShortcut(shortcutEvent({ key: "L", shiftKey: true }))).toBe(
			"toggle-sidebar",
		);
		expect(
			applicationCommandFromShortcut(
				shortcutEvent({ ctrlKey: false, key: "l", metaKey: true, shiftKey: true }),
			),
		).toBe("toggle-sidebar");
	});

	it("distinguishes shifted and unshifted commands", () => {
		expect(applicationCommandFromShortcut(shortcutEvent({ key: "s" }))).toBe("save");
		expect(applicationCommandFromShortcut(shortcutEvent({ key: "s", shiftKey: true }))).toBe(
			"save-as",
		);
	});

	it("ignores handled, composing, repeating, and modified events", () => {
		for (const overrides of [
			{ defaultPrevented: true },
			{ isComposing: true },
			{ repeat: true },
			{ altKey: true },
			{ metaKey: true },
		]) {
			expect(
				applicationCommandFromShortcut(shortcutEvent({ key: "l", shiftKey: true, ...overrides })),
			).toBeUndefined();
		}
	});

	it("derives native and visible shortcut labels from the same definition", () => {
		expect(applicationCommandAccelerator("toggle-sidebar")).toBe("CmdOrCtrl+Shift+L");
		expect(applicationCommandShortcutLabel("toggle-sidebar", false)).toBe("Ctrl+Shift+L");
		expect(applicationCommandShortcutLabel("toggle-sidebar", true)).toBe("⇧⌘L");
		expect(applicationCommandAccelerator("new-folder")).toBeUndefined();
	});

	it("uses platform-appropriate visible modifier labels", () => {
		expect(platformUsesCommandModifier("MacIntel")).toBe(true);
		expect(platformUsesCommandModifier("iPad")).toBe(true);
		expect(platformUsesCommandModifier("Win32")).toBe(false);
		expect(platformUsesCommandModifier(undefined)).toBe(false);
	});
});
