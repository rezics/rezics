import { expect, fn, waitFor } from "storybook/test";
import preview from "@/.storybook/preview";
import { DraftContentLanguageField } from "./draft-content-language-field";
import {
	useDraftContentLanguage,
	type DraftContentLanguageDetector,
} from "../hooks/use-draft-content-language";

const detector: DraftContentLanguageDetector = fn(
	async () => ({ status: "detected", language: "en" }) as const,
);
const meta = preview.meta({
	component: DraftContentLanguageField,
	tags: ["ai-generated"],
	render: function Render() {
		const controller = useDraftContentLanguage(
			"A reader can organize books, keep notes, and compare reading formats across many different publications.",
			detector,
		);
		return <DraftContentLanguageField controller={controller} />;
	},
});
export default meta;
export const AutomaticToManual = meta.story({
	render: function Render() {
		const controller = useDraftContentLanguage("", detector);
		return <DraftContentLanguageField controller={controller} />;
	},
	play: async ({ canvas, userEvent }) => {
		const select = canvas.getByRole("combobox");
		await userEvent.selectOptions(select, "ja");
		await expect(select).toHaveValue("ja");
		await userEvent.click(await canvas.findByRole("button"));
		await expect(select).toHaveValue("automatic");
	},
});
export const Detected = meta.story({
	render: function Render() {
		const controller = useDraftContentLanguage(
			"A reader can organize books, keep notes, and compare reading formats across many different publications.",
			detector,
		);
		return <DraftContentLanguageField controller={controller} />;
	},
	play: async ({ canvas }) => {
		await waitFor(() => expect(detector).toHaveBeenCalled(), { timeout: 3000 });
		await expect(canvas.getByRole("combobox")).toHaveValue("automatic");
	},
});
