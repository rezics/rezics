/** @vitest-environment jsdom */

import { cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	chapterQuery: {
		data: {
			bookId: "book-id",
			chapterId: "chapter-id",
			nodeId: "node-id",
		},
		isError: false,
		isPending: false,
	},
	postQuery: {
		data: undefined,
		isError: false,
		isPending: false,
	},
	replace: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/openapi-tanstack-query")>()),
	useGetApiChaptersByChapterId: () => state.chapterQuery,
	useGetApiPostsByPostId: () => state.postQuery,
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ replace: state.replace }),
}));

vi.mock("@/features/content-languages/hooks/use-content-language-navigation", () => ({
	useRequestedContentLanguage: () => undefined,
}));

vi.mock("@/features/content-languages/routing/content-language-route", () => ({
	withContentLanguage: (href: string) => href,
}));

vi.mock("@/features/posts/data/post-detail-context", () => ({
	usePostDetailContext: () => ({ data: { realms: [] }, isError: false }),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: {} }),
}));

vi.mock("@/i18n/use-localization-fallback-toast", () => ({
	useLocalizationFallbackToast: () => undefined,
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => [],
}));

vi.mock("@rezics/ui", async (importOriginal) => ({
	...(await importOriginal<typeof import("@rezics/ui")>()),
	QueryPending: () => <div data-testid="query-pending" />,
}));

import { PostDetailPage } from "./post-detail-page";

afterEach(cleanup);

beforeEach(() => {
	state.replace.mockReset();
	state.chapterQuery = {
		data: {
			bookId: "book-id",
			chapterId: "chapter-id",
			nodeId: "node-id",
		},
		isError: false,
		isPending: false,
	};
	state.postQuery = {
		data: undefined,
		isError: false,
		isPending: false,
	};
});

describe("PostDetailPage chapter routing", () => {
	it.each([
		["Global", undefined],
		["Realm", { kind: "realm", realmId: "realm-id" }],
		["Zone", { kind: "zone", zone: { id: "zone-id" } }],
	] as const)("redirects a chapter from the %s context to Reader", async (_name, context) => {
		render(<PostDetailPage context={context} id="chapter-id" />);

		await waitFor(() => {
			expect(state.replace).toHaveBeenCalledWith("/units/book/book-id/read/chapter-id", {
				scroll: false,
			});
		});
	});
});
