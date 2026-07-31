/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { WorkReleaseStatusField } from "./work-release-status-field";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

const translation = await create(resources).getTranslation(["units"], ["zh-Hant"]);

afterEach(cleanup);

describe("WorkReleaseStatusField", () => {
	it("preselects ongoing and exposes the complete localized status set", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<WorkReleaseStatusField />
			</TranslationProvider>,
		);

		const select = screen.getByRole("combobox", { name: "作品更新狀態" });
		expect(select).toHaveProperty("value", "ongoing");
		expect(
			screen.getAllByRole("option").map((option) => ({
				label: option.textContent,
				value: option.getAttribute("value"),
			})),
		).toEqual([
			{ label: "更新中", value: "ongoing" },
			{ label: "暫停更新", value: "hiatus" },
			{ label: "已完結", value: "completed" },
			{ label: "已取消", value: "cancelled" },
		]);
	});

	it("uses the persisted status when editing metadata", () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<WorkReleaseStatusField defaultValue="completed" />
			</TranslationProvider>,
		);

		expect(screen.getByRole("combobox", { name: "作品更新狀態" })).toHaveProperty(
			"value",
			"completed",
		);
	});
});
