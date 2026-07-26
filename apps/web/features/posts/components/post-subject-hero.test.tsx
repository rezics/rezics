/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
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
});
