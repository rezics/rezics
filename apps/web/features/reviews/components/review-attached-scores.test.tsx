/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen, within } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { realmHref } from "@/features/slugs/unit-route";
import { TranslationProvider } from "@/i18n/client";
import { ReviewAttachedScores } from "./review-attached-scores";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["engagement"], ["zh-Hant"]);

afterEach(cleanup);

describe("ReviewAttachedScores", () => {
	it("renders every attached Score in API order with its Realm", () => {
		const firstRealmId = "019f9872-bd49-7bb4-a6b7-ec621fca2061";
		const secondRealmId = "019f9872-bd49-7bb4-a6b7-ec621fca2062";
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ReviewAttachedScores
					reviewId="019f9872-bd49-7bb4-a6b7-ec621fca2060"
					scores={[
						{
							scoreId: "019f9872-bd49-7bb4-a6b7-ec621fca2063",
							realmId: firstRealmId,
							realmTitle: "REZICS 評分",
							value: 8,
						},
						{
							scoreId: "019f9872-bd49-7bb4-a6b7-ec621fca2064",
							realmId: secondRealmId,
							realmTitle: "讀書會評分",
							value: 4,
						},
					]}
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("heading", { level: 2, name: "評分" })).toBeTruthy();
		const items = within(screen.getByRole("list")).getAllByRole("listitem");
		expect(items).toHaveLength(2);
		expect(items[0]?.textContent).toBe("REZICS 評分8／10");
		expect(items[1]?.textContent).toBe("讀書會評分4／10");
		expect(screen.getByRole("link", { name: "REZICS 評分" }).getAttribute("href")).toBe(
			realmHref({ id: firstRealmId }),
		);
		expect(screen.getByRole("link", { name: "讀書會評分" }).getAttribute("href")).toBe(
			realmHref({ id: secondRealmId }),
		);
	});

	it("falls back to the stable Realm ID when no localized title exists", () => {
		const realmId = "019f9872-bd49-7bb4-a6b7-ec621fca2065";
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ReviewAttachedScores
					reviewId="019f9872-bd49-7bb4-a6b7-ec621fca2060"
					scores={[
						{
							scoreId: "019f9872-bd49-7bb4-a6b7-ec621fca2066",
							realmId,
							realmTitle: null,
							value: "6",
						},
					]}
				/>
			</TranslationProvider>,
		);

		expect(screen.getByRole("link", { name: realmId })).toBeTruthy();
		expect(screen.getByText("6／10")).toBeTruthy();
	});

	it("omits the section when no Score is attached", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<ReviewAttachedScores reviewId="019f9872-bd49-7bb4-a6b7-ec621fca2060" scores={[]} />
			</TranslationProvider>,
		);

		expect(screen.queryByRole("heading", { level: 2, name: "評分" })).toBeNull();
	});
});
