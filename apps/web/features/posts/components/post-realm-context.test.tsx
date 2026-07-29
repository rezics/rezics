/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import type { PostRealmContext } from "../model/post-realm-context";
import {
	PostRealmContextBar,
	PostRealmContextCard,
	PostRealmContextSelector,
} from "./post-realm-context";

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

HTMLElement.prototype.scrollTo = vi.fn();

const translation = await create(resources).getTranslation(["posts", "ui"], ["zh-Hant"]);
const realm = {
	id: "019f8cc9-407c-7006-9faf-56b267ce1987",
	language: "zh",
	slugAddress: null,
	title: "測試領域",
	summary: "這是領域摘要。",
	avatar: null,
} satisfies PostRealmContext;

afterEach(cleanup);

function renderWithTranslation(element: ReactNode) {
	return render(
		<TranslationProvider initial={translation.snapshot}>{element}</TranslationProvider>,
	);
}

describe("PostRealmContext", () => {
	it("keeps Global selected and first in the fixed context options", async () => {
		renderWithTranslation(
			<PostRealmContextSelector
				onValueChange={vi.fn()}
				realms={[realm]}
				value={{ kind: "global" }}
			/>,
		);

		const trigger = screen.getByRole("combobox", { name: "選擇領域脈絡" });
		expect(trigger.textContent).toContain("全域");
		fireEvent.click(trigger);

		const options = await screen.findAllByRole("option");
		expect(options[0]?.textContent).toContain("全域");
		expect(options.map((option) => option.textContent)).toEqual(
			expect.arrayContaining([
				expect.stringContaining("全域"),
				expect.stringContaining("測試領域"),
			]),
		);
	});

	it("returns directly to the Realm represented by the context bar", () => {
		renderWithTranslation(<PostRealmContextBar realm={realm} />);

		expect(screen.getByRole("link", { name: "返回" }).getAttribute("href")).toBe(
			"/realm/019f8cc9-407c-7006-9faf-56b267ce1987",
		);
		expect(screen.getByRole("link", { name: /測試領域/ }).getAttribute("href")).toBe(
			"/realm/019f8cc9-407c-7006-9faf-56b267ce1987",
		);
	});

	it("keeps only the localized Realm summary in the sidebar card", () => {
		const { container } = renderWithTranslation(<PostRealmContextCard realm={realm} />);

		expect(screen.getByText("領域簡介")).toBeTruthy();
		expect(screen.getByText("這是領域摘要。")).toBeTruthy();
		expect(container.querySelector('[data-slot="avatar"]')).toBeNull();
		expect(screen.queryByRole("link")).toBeNull();
	});
});
