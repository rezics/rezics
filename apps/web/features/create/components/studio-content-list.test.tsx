/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { StudioContentList } from "./studio-content-list";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["actions", "create"], ["zh-Hant"]);

afterEach(cleanup);

describe("StudioContentList", () => {
	it("uses cover-shaped skeletons without hiding the surrounding page", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentList
					hasNextPage={false}
					isFetchingNextPage={false}
					loadMore={vi.fn()}
					onOpen={vi.fn()}
					sectionId="book"
					sort="recent"
					state={{ status: "pending" }}
				/>
			</TranslationProvider>,
		);

		expect(container.querySelector("[aria-busy=true]")).toBeTruthy();
		expect(container.querySelectorAll('[data-slot="content-card"]')).toHaveLength(4);
		expect(container.querySelectorAll('[data-slot="cover"]')).toHaveLength(4);
	});

	it("renders inline error and empty states", () => {
		const retry = vi.fn();
		const { rerender } = render(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentList
					hasNextPage={false}
					isFetchingNextPage={false}
					loadMore={vi.fn()}
					onOpen={vi.fn()}
					sectionId="tag"
					sort="recent"
					state={{ status: "error", error: new Error("failed"), retry }}
				/>
			</TranslationProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retry).toHaveBeenCalledOnce();

		rerender(
			<TranslationProvider initial={translation.snapshot}>
				<StudioContentList
					hasNextPage={false}
					isFetchingNextPage={false}
					loadMore={vi.fn()}
					onOpen={vi.fn()}
					sectionId="tag"
					sort="recent"
					state={{ status: "ready", items: [] }}
				/>
			</TranslationProvider>,
		);
		expect(screen.getByRole("status").textContent).toContain("沒有符合目前篩選條件的內容。");
	});
});
