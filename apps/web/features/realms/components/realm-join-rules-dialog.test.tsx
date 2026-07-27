/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { RealmJoinRulesDialog } from "./realm-join-rules-dialog";

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserver {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const translation = await create(resources).getTranslation(["realms"], ["zh-Hant"]);

afterEach(cleanup);

describe("RealmJoinRulesDialog", () => {
	it("requires an explicit acknowledgement before confirming", () => {
		const onConfirm = vi.fn();
		render(
			<TranslationProvider initial={translation.snapshot}>
				<RealmJoinRulesDialog
					isPending={false}
					onConfirm={onConfirm}
					onOpenChange={vi.fn()}
					open
					rules={[
						{
							id: "019fa2b0-1000-7000-8000-000000000001",
							title: "尊重其他成員",
							content: {
								_type: "portable-text",
								_key: "000000000001",
								content: [],
							},
						},
					]}
				/>
			</TranslationProvider>,
		);

		const confirm = screen.getByRole("button", { name: "同意並加入" });
		expect((confirm as HTMLButtonElement).disabled).toBe(true);
		const agreement = screen.getByRole("button", {
			name: "我已閱讀並同意遵守這些規則。",
		});
		expect(agreement.getAttribute("aria-pressed")).toBe("false");
		fireEvent.click(agreement);
		expect(agreement.getAttribute("aria-pressed")).toBe("true");
		expect((confirm as HTMLButtonElement).disabled).toBe(false);
		fireEvent.click(confirm);
		expect(onConfirm).toHaveBeenCalledOnce();
	});
});
