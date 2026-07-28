/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { ChineseContentDisplayProvider } from "@/features/content-language-display/chinese-content-display-context";
import { PostSubjectHero } from "./post-subject-hero";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["feed", "ui"], ["zh-Hant"]);

afterEach(cleanup);

describe("PostSubjectHero", () => {
	it("renders a fixed-ratio Unit context card without requiring a cover", () => {
		const { container } = render(
			<TranslationProvider initial={translation.snapshot}>
				<PostSubjectHero
					subject={{
						id: "019f9872-bd49-7bb4-a6b7-ec621fca2051",
						type: "book",
						language: "zh",
						title: "上下文書籍",
						summary: "作品摘要",
						cover: null,
					}}
				/>
			</TranslationProvider>,
		);

		expect(container.querySelector('[data-slot="cover"]')).toBeTruthy();
		expect(screen.getByRole("link", { name: /上下文書籍/ }).getAttribute("href")).toBe(
			"/units/book/019f9872-bd49-7bb4-a6b7-ec621fca2051",
		);
	});

	it("applies the viewer's Chinese display preference without changing the source model", async () => {
		const subject = {
			id: "019f9872-bd49-7bb4-a6b7-ec621fca2052",
			type: "book",
			language: "zh" as const,
			title: "學習與軟體",
			summary: "這是繁體內容。",
			cover: null,
		};
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ChineseContentDisplayProvider value="hans">
					<PostSubjectHero subject={subject} />
				</ChineseContentDisplayProvider>
			</TranslationProvider>,
		);

		await waitFor(() => expect(screen.getByText("学习与软体")).toBeTruthy());
		expect(screen.getByText("这是繁体内容。")).toBeTruthy();
		expect(subject.title).toBe("學習與軟體");
	});
});
