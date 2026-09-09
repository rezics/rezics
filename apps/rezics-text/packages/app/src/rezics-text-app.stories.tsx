import { useState, type ComponentProps } from "react";
import { expect, fn, waitFor, within, userEvent as storyUserEvent } from "storybook/test";
import { useGlobals } from "storybook/preview-api";
import preview from "../../../.storybook/preview";
import { RezicsTextApp } from "./rezics-text-app";
import { rezicsTextMessages, isRezicsTextLocale } from "./i18n/messages";
import {
	markdownStorageFailure,
	markdownStorageSuccess,
	type MarkdownDocumentStorage,
} from "./storage";
import type { RezicsTextThemePreference } from "./domain/appearance";

const opened = {
	storageId: "story-document",
	name: "reading-notes.md",
	source: "# Reading notes\n\nA document opened from the story storage.",
	fingerprint: "revision-1",
	canOverwrite: true,
};
const saved = {
	storageId: opened.storageId,
	name: opened.name,
	fingerprint: "revision-2",
	canOverwrite: true,
};

// Each factory creates independent observable storage. No browser files or Tauri commands.
function createStoryStorage(): MarkdownDocumentStorage {
	return {
		openDocument: fn(async () => markdownStorageSuccess(opened)),
		saveDocument: fn(async () => markdownStorageSuccess(saved)),
		saveDocumentAs: fn(async () => markdownStorageSuccess(saved)),
	};
}

const workspaceArgs = {
	storage: createStoryStorage(),
	themePreference: "light",
	onThemePreferenceChange: fn(),
} satisfies ComponentProps<typeof RezicsTextApp>;
const meta = preview.meta({
	component: RezicsTextApp,
	tags: ["ai-generated"],
	render: function Render(args) {
		const [globals] = useGlobals();
		const [theme, setTheme] = useState<RezicsTextThemePreference>(
			globals.theme === "dark" ? "dark" : "light",
		);
		return (
			<RezicsTextApp
				{...args}
				initialLocale={isRezicsTextLocale(globals.locale) ? globals.locale : "en"}
				themePreference={theme}
				onThemePreferenceChange={(next) => {
					setTheme(next);
					document.documentElement.classList.toggle("dark", next === "dark");
					document.documentElement.dataset.theme = next;
					args.onThemePreferenceChange(next);
				}}
			/>
		);
	},
});
export default meta;
const base = meta.story({ args: workspaceArgs });

export const Workspace = base.extend({
	play: async ({ canvas, globals }) => {
		const messages = rezicsTextMessages[isRezicsTextLocale(globals.locale) ? globals.locale : "en"];
		await expect(await canvas.findByRole("textbox")).toBeVisible();
		await expect(canvas.getByRole("navigation", { name: messages.labels.menuBar })).toBeVisible();
	},
});
export const OpenEditSave = base.extend({
	args: { storage: createStoryStorage() },
	play: async ({ canvas, userEvent, args }) => {
		await canvas.findByRole("textbox");
		await userEvent.keyboard("{Control>}o{/Control}");
		await waitFor(() => expect(args.storage.openDocument).toHaveBeenCalledOnce());
		const editor = canvas.getByRole("textbox");
		await waitFor(() => expect(editor).toHaveTextContent("Reading notes"));
		await userEvent.click(editor);
		await userEvent.keyboard("{Control>}{End}{/Control}{Enter}");
		await storyUserEvent.setup({ delay: 30 }).type(editor, "Updated notes", { skipClick: true });
		await expect(editor).toHaveTextContent("Updated notes");
		await userEvent.keyboard("{Control>}s{/Control}");
		await waitFor(() =>
			expect(args.storage.saveDocument).toHaveBeenCalledWith(
				expect.objectContaining({
					expectedFingerprint: "revision-1",
					source: expect.stringContaining("Updated notes"),
				}),
			),
		);
		await expect(await canvas.findByText(rezicsTextMessages.en.notices.saved)).toBeVisible();
	},
});
export const OpenFailure = base.extend({
	args: {
		storage: {
			...createStoryStorage(),
			openDocument: fn(async () => markdownStorageFailure("io")),
		},
	},
	play: async ({ canvas, userEvent, args }) => {
		await canvas.findByRole("textbox");
		await userEvent.keyboard("{Control>}o{/Control}");
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			rezicsTextMessages.en.notices.storageErrors.io,
		);
		await expect(args.storage.openDocument).toHaveBeenCalledOnce();
	},
});
export const SaveConflict = base.extend({
	args: {
		storage: {
			...createStoryStorage(),
			saveDocument: fn(async () => markdownStorageFailure("conflict")),
		},
	},
	play: async ({ canvas, userEvent }) => {
		await canvas.findByRole("textbox");
		await userEvent.keyboard("{Control>}o{/Control}");
		await waitFor(() => expect(canvas.getByRole("textbox")).toHaveTextContent("Reading notes"));
		await userEvent.click(canvas.getByRole("textbox"));
		await userEvent.keyboard("{Control>}{End}{/Control}");
		await storyUserEvent
			.setup({ delay: 30 })
			.type(canvas.getByRole("textbox"), " changed", { skipClick: true });
		await userEvent.keyboard("{Control>}s{/Control}");
		await expect(await canvas.findByRole("alert")).toHaveTextContent(
			rezicsTextMessages.en.notices.storageErrors.conflict,
		);
		await expect(canvas.getByRole("textbox")).toHaveTextContent("changed");
	},
});
export const SourceMode = base.extend({
	play: async ({ canvas, userEvent }) => {
		await canvas.findByRole("textbox");
		await userEvent.click(
			canvas.getByRole("button", { name: rezicsTextMessages.en.actions.enterSource }),
		);
		await expect(
			canvas.getByRole("textbox", { name: rezicsTextMessages.en.labels.sourceEditor }),
		).toBeVisible();
	},
});
SourceMode.test("Return to live preview", async ({ canvas, userEvent }) => {
	await userEvent.click(
		canvas.getByRole("button", { name: rezicsTextMessages.en.actions.enterLivePreview }),
	);
	await expect(
		canvas.getByRole("textbox", { name: rezicsTextMessages.en.labels.livePreviewEditor }),
	).toBeVisible();
});
export const Preferences = base.extend({
	play: async ({ canvas, canvasElement, userEvent }) => {
		await canvas.findByRole("textbox");
		await userEvent.keyboard("{Control>},{/Control}");
		await expect(
			await within(canvasElement.ownerDocument.body).findByText(
				rezicsTextMessages.en.preferences.description,
			),
		).toBeVisible();
	},
});
export const TraditionalChineseDark = Workspace.extend({
	globals: { locale: "zh-Hant", theme: "dark" },
});
export const NewDocument = base.extend({
	play: async ({ canvas, userEvent }) => {
		await canvas.findByRole("textbox");
		await userEvent.keyboard("{Control>}n{/Control}");
		await waitFor(() =>
			expect(canvas.getByRole("textbox")).toHaveTextContent(
				rezicsTextMessages.en.labels.editorPlaceholder,
			),
		);
		await userEvent.click(canvas.getByRole("textbox"));
		await storyUserEvent
			.setup({ delay: 30 })
			.type(canvas.getByRole("textbox"), "New reading notes");
		await expect(canvas.getByRole("textbox")).toHaveTextContent("New reading notes");
	},
});
export const PreferencesMobile = Preferences.extend({
	globals: { viewport: { value: "mobile", isRotated: false } },
});
