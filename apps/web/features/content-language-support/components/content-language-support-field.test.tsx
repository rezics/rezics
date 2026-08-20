/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
	it("canonicalizes a language and never emits an empty channel array", async () => {
		render(<FieldHarness />);

		fireEvent.change(screen.getByRole("textbox", { name: "Language tag" }), {
			target: { value: "EN-us" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add language" }));
		expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"en-US"}]');

		fireEvent.click(screen.getByText("Text"));
		await waitFor(() =>
			expect(screen.getByTestId("draft").textContent).toBe(
				'[{"languageTag":"en-US","channels":["text"]}]',
			),
		);

		fireEvent.click(screen.getByText("Text"));
		await waitFor(() =>
			expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"en-US"}]'),
		);
		expect(screen.getByText("Channels not specified")).toBeTruthy();
		expect(screen.getByTestId("draft").textContent).not.toContain('"channels":[]');
	});

	it("keeps an invalid language out of the controlled value", () => {
		render(<FieldHarness initial={[{ languageTag: "ja" }]} />);

		fireEvent.change(screen.getByRole("textbox", { name: "Language tag" }), {
			target: { value: "en_US" },
		});
		fireEvent.click(screen.getByRole("button", { name: "Add language" }));

		expect(screen.getByRole("alert").textContent).toBe("Enter a valid language tag.");
		expect(screen.getByTestId("draft").textContent).toBe('[{"languageTag":"ja"}]');
	});
});
