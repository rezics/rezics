/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { create } from "native-i18n";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import {
	createContentLanguageSupportDraft,
	type ContentLanguageSupportDraft,
} from "../model/content-language-support";
import { ContentLanguageSupportField } from "./content-language-support-field";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["units"], ["en"]);

afterEach(cleanup);

function FieldHarness({ initial = [] }: { readonly initial?: unknown }) {
	const [value, setValue] = useState<ContentLanguageSupportDraft>(() =>
		createContentLanguageSupportDraft(initial),
	);
	return (
		<TranslationProvider initial={translation.snapshot}>
			<ContentLanguageSupportField onChange={setValue} value={value} />
			<output data-testid="draft">{JSON.stringify(value)}</output>
		</TranslationProvider>
	);
}

describe("ContentLanguageSupportField", () => {
	it("adds only a selected language and never emits an empty channel array", async () => {
		render(<FieldHarness />);

		expect(screen.queryByRole("textbox")).toBeNull();
		const languageSelect = screen.getByRole("combobox", { name: "Language" });
		expect(screen.getByRole("button", { name: "Add language" }).hasAttribute("disabled")).toBe(
			true,
		);
		fireEvent.change(languageSelect, {
			target: { value: "zh-Hant" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add language" }));
		expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"zh-Hant"}]');
		expect(screen.getAllByText("Traditional Chinese").length).toBeGreaterThan(0);

		fireEvent.click(screen.getByText("Text"));
		await waitFor(() =>
			expect(screen.getByTestId("draft").textContent).toBe(
				'[{"languageTag":"zh-Hant","channels":["text"]}]',
			),
		);

		fireEvent.click(screen.getByText("Text"));
		await waitFor(() =>
			expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"zh-Hant"}]'),
		);
		expect(screen.getByText("Channels not specified")).toBeTruthy();
		expect(screen.getByTestId("draft").textContent).not.toContain('"channels":[]');
	});

	it("excludes languages that are already in the controlled value", () => {
		render(<FieldHarness initial={[{ languageTag: "ja" }]} />);

		const languageSelect = screen.getByRole("combobox", { name: "Language" });
		expect(within(languageSelect).queryByRole("option", { name: "Japanese" })).toBeNull();
		expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"ja"}]');
	});
});
