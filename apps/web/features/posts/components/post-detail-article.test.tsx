/** @vitest-environment jsdom */

import { createPortableTextDocument } from "@rezics/block";
import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { PostDetailArticle } from "./post-detail-article";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@/features/content-feed/components/feed-card-actions", () => ({
	ConnectedFeedEngagementBar: () => <div data-slot="connected-reaction-bar" />,
}));

const translation = await create(resources).getTranslation(
	["engagement", "feed", "posts", "units"],
	["zh-Hant"],
);

afterEach(cleanup);

describe("PostDetailArticle", () => {
	it("renders Review content and the shared reaction bar", () => {
		const body = createPortableTextDocument([
			{
				_type: "block",
				_key: "review-block",
				children: [
					{
						_type: "span",
						_key: "review-span",
						text: "完整評論內容",
						marks: [],
					},
				],
				markDefs: [],
				style: "normal",
			},
		]);
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<PostDetailArticle
					post={{
						id: "019f9872-bd49-7bb4-a6b7-ec621fca2050",
						postKind: "review",
						attributions: [],
						realmId: null,
						language: "zh",
						title: "完整評論",
						titleLanguage: "zh",
						summary: "不暴雷的摘要",
						body,
						contentSpoiler: { level: 0, concealed: false },
						contentNsfw: { labelled: false, concealed: false },
						createdAt: "2026-07-25T04:00:00.000Z",
					}}
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("heading", { level: 1, name: "完整評論" })).toBeTruthy();
		expect(screen.getByText("不暴雷的摘要")).toBeTruthy();
		expect(screen.getByText("完整評論內容")).toBeTruthy();
		expect(container.querySelector('[data-slot="connected-reaction-bar"]')).toBeTruthy();
	});

	it("renders only Publisher attributions in the open Post byline", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<PostDetailArticle
					post={{
						id: "019f9872-bd49-7bb4-a6b7-ec621fca2051",
						postKind: "post",
						attributions: [
							{
								id: "publisher-credit",
								role: "publisher",
								creditedUnit: {
									id: "publisher",
									kind: "profile",
									title: "海豚號編輯部",
								},
							},
							{
								id: "author-credit",
								role: "author",
								creditedUnit: {
									id: "author",
									kind: "profile",
									title: "不應顯示的作者署名",
								},
							},
						],
						realmId: null,
						language: "zh",
						title: "開放式貼文",
						titleLanguage: "zh",
						body: null,
						contentSpoiler: { level: 0, concealed: false },
						contentNsfw: { labelled: false, concealed: false },
						createdAt: "2026-07-25T04:00:00.000Z",
					}}
					variant="thread"
				/>
			</TranslationProvider>,
		);

		expect(screen.getByText("海豚號編輯部")).toBeTruthy();
		expect(screen.getByText("發佈者")).toBeTruthy();
		expect(screen.queryByText("不應顯示的作者署名")).toBeNull();
		expect(container.querySelector('[data-slot="card"]')).toBeNull();
	});

	it("omits the heading when a Post has no authored title", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<PostDetailArticle
					post={{
						id: "019f9872-bd49-7bb4-a6b7-ec621fca2052",
						postKind: "post",
						attributions: [],
						realmId: null,
						language: "zh",
						title: null,
						titleLanguage: null,
						summary: "沒有標題也要保留的摘要",
						body: null,
						contentSpoiler: { level: 0, concealed: false },
						contentNsfw: { labelled: false, concealed: false },
						createdAt: "2026-07-25T04:00:00.000Z",
					}}
					variant="thread"
				/>
			</TranslationProvider>,
		);

		expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
		expect(screen.getByText("沒有標題也要保留的摘要")).toBeTruthy();
	});
});
