/** @vitest-environment jsdom */

import type { ContentLanguage } from "@rezics/i18n";
import { resources } from "@rezics/i18n/resources";
import type { ChoiceOption } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { FeedFiltersDialog } from "./feed-filters-dialog";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const translation = await create(resources).getTranslation(["feed"], ["zh-Hant"]);
const languageOptions = [
	{ value: "zh", label: "中文" },
	{ value: "en", label: "英文" },
] satisfies readonly ChoiceOption<ContentLanguage>[];
const realmOptions = [{ value: "realm-1", label: "第一領域" }];
const tagOptions = [{ value: "tag-1", label: "第一標籤" }];

afterEach(cleanup);

describe("FeedFiltersDialog", () => {
	it("offers only language and tag filters for a fixed Realm scope", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedFiltersDialog
					languageOptions={languageOptions}
					languages={[]}
					onClose={vi.fn()}
					onLanguagesChange={vi.fn()}
					onTagIdsChange={vi.fn()}
					realmIds={["realm-1"]}
					realmOptions={realmOptions}
					tagIds={[]}
					tagOptions={tagOptions}
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("combobox", { name: "語言" })).toBeDefined();
		expect(screen.getByRole("combobox", { name: "標籤" })).toBeDefined();
		expect(screen.queryByRole("combobox", { name: "領域" })).toBeNull();
		expect(screen.getByRole("button", { name: "清除篩選" }).hasAttribute("disabled")).toBe(
			true,
		);
	});

	it("applies cleared editable filters together", () => {
		const onClose = vi.fn();
		const onLanguagesChange = vi.fn();
		const onTagIdsChange = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<FeedFiltersDialog
					languageOptions={languageOptions}
					languages={["en"]}
					onClose={onClose}
					onLanguagesChange={onLanguagesChange}
					onTagIdsChange={onTagIdsChange}
					realmIds={["realm-1"]}
					realmOptions={realmOptions}
					tagIds={["tag-1"]}
					tagOptions={tagOptions}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "清除篩選" }));
		fireEvent.click(screen.getByRole("button", { name: "套用篩選" }));

		expect(onLanguagesChange).toHaveBeenCalledWith([]);
		expect(onTagIdsChange).toHaveBeenCalledWith([]);
		expect(onClose).toHaveBeenCalledOnce();
	});
});
