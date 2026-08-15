/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	postQuery: { data: undefined, isError: false, isPending: true },
	postHook: vi.fn(),
	replace: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/openapi-tanstack-query")>()),
	useGetApiPostsByPostId: (options: unknown) => {
		state.postHook(options);
		return state.postQuery;
	},
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: state.replace }),
}));

vi.mock("@/features/content-languages/hooks/use-content-language-navigation", () => ({
	useRequestedContentLanguage: () => undefined,
}));

vi.mock("@/features/posts/data/post-detail-context", () => ({
	usePostDetailContext: () => ({ data: { realms: [] }, isError: false }),
}));

vi.mock("@/i18n/client", () => ({ useTranslation: () => ({ t: {} }) }));
vi.mock("@/i18n/use-localization-fallback-toast", () => ({
	useLocalizationFallbackToast: () => undefined,
}));
vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh"],
}));
vi.mock("@rezics/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/ui")>()),
	QueryPending: () => <div data-testid="query-pending" />,
}));

import { PostDetailPage } from "./post-detail-page";

afterEach(cleanup);

beforeEach(() => {
	state.postHook.mockReset();
	state.replace.mockReset();
});

describe("PostDetailPage Chapter independence", () => {
	it("loads the ID through the standalone Post contract without guessing a Book", () => {
		render(<PostDetailPage id="chapter-id" />);

		expect(screen.getByTestId("query-pending")).toBeTruthy();
		expect(state.postHook).toHaveBeenCalledWith({
			path: { postId: "chapter-id" },
			query: { localizationLanguages: ["zh"] },
		});
		expect(state.replace).not.toHaveBeenCalled();
	});
});
