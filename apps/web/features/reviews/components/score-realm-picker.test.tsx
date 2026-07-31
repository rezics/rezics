/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ScoreRealmPicker, type ScoreRealmOption } from "./score-realm-picker";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(
	["engagement", "state", "ui"],
	["zh-Hant"],
);
const realmScore = {
	id: "realm-score",
	label: "Realm Score",
} satisfies ScoreRealmOption;

afterEach(cleanup);

describe("ScoreRealmPicker", () => {
	it("shows a scoring Realm that resolves after the picker mounts", () => {
		const view = render(
			<TranslationProvider initial={translation.snapshot}>
				<ScoreRealmPicker onChange={vi.fn()} options={[]} />
			</TranslationProvider>,
		);

		expect(screen.getByRole<HTMLInputElement>("combobox").value).toBe("");

		view.rerender(
			<TranslationProvider initial={translation.snapshot}>
				<ScoreRealmPicker onChange={vi.fn()} options={[realmScore]} value={realmScore} />
			</TranslationProvider>,
		);

		expect(screen.getByRole<HTMLInputElement>("combobox").value).toBe("Realm Score");
	});
});
