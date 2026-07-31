/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	pushLanguage: vi.fn(),
	replaceCurrentLanguage: vi.fn(),
	valueChange: undefined as ((details: { value: string }) => void) | undefined,
}));

vi.mock("@rezics/ui", () => ({
	MenuRadioGroup: ({
		children,
		onValueChange,
	}: {
		children: React.ReactNode;
		onValueChange?: (details: { value: string }) => void;
	}) => {
		mocks.valueChange = onValueChange;
		return <div>{children}</div>;
	},
	MenuRadioItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
		<button onClick={() => mocks.valueChange?.({ value })} type="button">
			{children}
		</button>
	),
	MenuSub: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	MenuSubContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	MenuSubTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("../hooks/use-content-language-navigation", () => ({
	useContentLanguageNavigation: () => ({
		pushLanguage: mocks.pushLanguage,
		replaceCurrentLanguage: mocks.replaceCurrentLanguage,
	}),
	useRequestedContentLanguage: () => undefined,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			locale: {
				contentLanguages: { zh: "中文", ko: "韓文" },
				contentVersions: { action: "語言版本", automatic: "自動選擇" },
			},
		},
	}),
}));

import { ContentLanguageVersionMenu } from "./content-language-version-menu";

beforeEach(() => {
	mocks.pushLanguage.mockReset();
	mocks.replaceCurrentLanguage.mockReset();
	mocks.valueChange = undefined;
});

afterEach(cleanup);

describe("ContentLanguageVersionMenu", () => {
	it("navigates from the radio-group value change for an item version", () => {
		render(
			<ContentLanguageVersionMenu
				availableLanguages={["zh", "ko"]}
				baseHref="/units/book/123"
				currentLanguage="zh"
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "韓文" }));

		expect(mocks.pushLanguage).toHaveBeenCalledWith("/units/book/123", "ko");
	});

	it("restores automatic selection on the current detail page", () => {
		render(
			<ContentLanguageVersionMenu availableLanguages={["zh", "ko"]} currentLanguage="zh" />,
		);

		act(() => fireEvent.click(screen.getByRole("button", { name: "自動選擇" })));

		expect(mocks.replaceCurrentLanguage).toHaveBeenCalledWith(undefined);
	});
});
