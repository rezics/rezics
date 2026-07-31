/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	pathname: "/posts/123",
	push: vi.fn(),
	replace: vi.fn(),
	searchParams: new URLSearchParams("realmId=abc"),
}));

vi.mock("next/navigation", () => ({
	usePathname: () => mocks.pathname,
	useSearchParams: () => mocks.searchParams,
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push: mocks.push, replace: mocks.replace }),
}));

import { useContentLanguageNavigation } from "./use-content-language-navigation";

beforeEach(() => {
	mocks.push.mockReset();
	mocks.replace.mockReset();
	window.location.hash = "#replies";
});

describe("content-language navigation", () => {
	it("replaces the current version without losing query context or the fragment", () => {
		const { result } = renderHook(useContentLanguageNavigation);

		act(() => result.current.replaceCurrentLanguage("ja"));

		expect(mocks.replace).toHaveBeenCalledWith("/posts/123?realmId=abc&language=ja#replies", {
			scroll: false,
		});
	});

	it("pushes an item version while preserving its own route context", () => {
		const { result } = renderHook(useContentLanguageNavigation);

		act(() => result.current.pushLanguage("/posts/456?realmId=def", "ko"));

		expect(mocks.push).toHaveBeenCalledWith("/posts/456?realmId=def&language=ko");
	});
});
