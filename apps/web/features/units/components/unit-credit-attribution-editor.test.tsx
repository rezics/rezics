/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { UiProvider, type EntitySearch } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitCreditAttributionEditor } from "./unit-credit-attribution-editor";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		EntityPicker: ({
			ariaLabel,
			index,
			search,
		}: {
			readonly ariaLabel: string;
			readonly index: string;
			readonly search?: EntitySearch;
		}) => (
			<actual.Button
				aria-label={ariaLabel}
				data-index={index}
				onClick={() => void search?.(index, "Studio", new AbortController().signal)}
				type="button"
			/>
		),
	};
});

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const translation = await create(resources).getTranslation(["ui", "units"], ["zh-Hant"]);
function renderEditor({
	onChange = vi.fn(),
	search = vi.fn(async () => []),
	searchScope = "public",
}: {
	readonly onChange?: ComponentProps<typeof UnitCreditAttributionEditor>["onChange"];
	readonly search?: EntitySearch;
	readonly searchScope?: ComponentProps<typeof UnitCreditAttributionEditor>["searchScope"];
} = {}) {
	const result = render(
		<TranslationProvider initial={translation.snapshot}>
			<UiProvider searchEntities={search}>
				<UnitCreditAttributionEditor
					onChange={onChange}
					searchScope={searchScope}
					type="media"
					value={[{ key: "first" }]}
				/>
			</UiProvider>
		</TranslationProvider>,
	);
	return { ...result, onChange, search };
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

describe("UnitCreditAttributionEditor", () => {
	it("renders role first, Entity search second, and no visible field-set heading", () => {
		const { container } = renderEditor();
		const role = screen.getByRole("combobox", { name: "署名角色 1" });
		const entity = screen.getByRole("button", { name: "署名實體 1" });

		expect(
			role.compareDocumentPosition(entity) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
		expect(entity.getAttribute("data-index")).toBe("entities");
		expect(container.querySelector("legend")).toBeNull();
		expect(screen.getByText("署名角色 1").classList.contains("sr-only")).toBe(true);
		expect(screen.getByText("署名實體 1").classList.contains("sr-only")).toBe(true);
	});

	it("separates direct-permission and public Entity searches", () => {
		const personal = renderEditor({ searchScope: "direct" });
		fireEvent.click(screen.getByRole("button", { name: "署名實體 1" }));
		expect(personal.search).toHaveBeenCalledWith(
			"entities",
			"Studio",
			expect.any(AbortSignal),
			{ creditAttributionSearch: "direct" },
		);
		cleanup();

		const publicEditor = renderEditor({ searchScope: "public" });
		fireEvent.click(screen.getByRole("button", { name: "署名實體 1" }));
		expect(publicEditor.search).toHaveBeenCalledWith(
			"entities",
			"Studio",
			expect.any(AbortSignal),
			{ creditAttributionSearch: "public" },
		);
	});

	it("uses an icon-only removal control and preserves one blank row", () => {
		vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(
			"019fa2b0-1000-7000-8000-000000000002",
		);
		const { onChange } = renderEditor();
		fireEvent.click(screen.getByRole("button", { name: "新增署名" }));
		expect(onChange).toHaveBeenCalledWith([
			{ key: "first" },
			{ key: "019fa2b0-1000-7000-8000-000000000002" },
		]);
		vi.mocked(onChange).mockClear();

		const remove = screen.getByRole("button", { name: "移除第 1 筆署名" });

		expect(remove.textContent).toBe("");
		fireEvent.click(remove);
		expect(onChange).toHaveBeenCalledWith([{ key: "019fa2b0-1000-7000-8000-000000000002" }]);
	});
});
