/** @vitest-environment jsdom */

import type { GetApiReportsUnitsByUnitIdDestinationsStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	ContentRuleMultiSelect,
	ContentRuleSourceSelect,
	type ContentRuleMultiSelectLabels,
	type ContentRuleSourceSelectLabels,
} from "./content-rule-picker";

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

vi.stubGlobal("scrollTo", vi.fn());
if (!HTMLElement.prototype.scrollTo) {
	HTMLElement.prototype.scrollTo = vi.fn();
}

const sourceLabels = {
	ariaLabel: "規則來源",
	choose: "選擇規則來源",
	scopeLabels: {
		platform: "平台",
		realm: "治理範圍",
	},
} satisfies ContentRuleSourceSelectLabels;

const ruleLabels = {
	ariaLabel: "適用規則",
	choose: "選擇規則",
	clear: "清除已選規則",
	selectedCount: ({ count }: { readonly count: number }) => `已選 ${count} / 32 條規則`,
} satisfies ContentRuleMultiSelectLabels;

const destinations = [
	{
		id: "realm-destination",
		scope: "realm",
		language: "zh",
		title: "社群規則",
		revisionId: "realm-revision",
		rules: [
			{ id: "rule-spam", language: "zh", title: "禁止垃圾內容" },
			{ id: "rule-abuse", language: "zh", title: "禁止騷擾行為" },
		],
	},
	{
		id: "official-destination",
		scope: "platform",
		language: "zh",
		title: "官方規則",
		revisionId: "official-revision",
		rules: [{ id: "rule-safety", language: "zh", title: "危害安全的內容" }],
	},
] satisfies GetApiReportsUnitsByUnitIdDestinationsStatus200["items"];

function ruleKey(destinationId: string, revisionId: string, ruleId: string): string {
	return `${destinationId}:${revisionId}:${ruleId}`;
}

function renderRuleSelector(
	selectedKeys: readonly string[] = [],
	options: GetApiReportsUnitsByUnitIdDestinationsStatus200["items"] = destinations,
) {
	return render(
		<ContentRuleMultiSelect
			destination={options[0]}
			labels={ruleLabels}
			onClear={vi.fn()}
			onRuleCheckedChange={vi.fn()}
			selectedKeys={selectedKeys}
			totalSelectedCount={selectedKeys.length}
		/>,
	);
}

afterEach(cleanup);

describe("ContentRuleSourceSelect", () => {
	it("selects one rule source independently from the rule picker", async () => {
		const onValueChange = vi.fn();

		render(
			<ContentRuleSourceSelect
				destinations={destinations}
				labels={sourceLabels}
				onValueChange={onValueChange}
				value="realm-destination"
			/>,
		);

		const trigger = screen.getByRole("combobox", { name: "規則來源" });
		expect(trigger.textContent).toContain("社群規則");

		fireEvent.click(trigger);
		const listbox = await screen.findByRole("listbox");
		fireEvent.keyDown(listbox, { key: "ArrowDown" });
		await waitFor(() =>
			expect(listbox.getAttribute("aria-activedescendant")).toContain("official-destination"),
		);
		fireEvent.keyDown(listbox, { key: "Enter" });

		await waitFor(() => expect(onValueChange).toHaveBeenCalledWith("official-destination"));
	});
});

describe("ContentRuleMultiSelect", () => {
	it("keeps rules inside a multi-select dropdown", async () => {
		renderRuleSelector();

		const trigger = screen.getByRole("button", { name: "適用規則" });
		expect(trigger.textContent).toContain("選擇規則");
		expect(screen.queryByRole("menu")).toBeNull();

		fireEvent.click(trigger);

		expect(await screen.findByRole("menu")).toBeTruthy();
		expect(screen.getAllByRole("menuitemcheckbox")).toHaveLength(2);
	});

	it("supports selection without closing and offers clear-all", async () => {
		const onClear = vi.fn();
		const onRuleCheckedChange = vi.fn();
		const selected = ruleKey("realm-destination", "realm-revision", "rule-spam");
		const view = render(
			<ContentRuleMultiSelect
				destination={destinations[0]}
				labels={ruleLabels}
				onClear={onClear}
				onRuleCheckedChange={onRuleCheckedChange}
				selectedKeys={[]}
				totalSelectedCount={0}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "適用規則" }));
		const menu = await screen.findByRole("menu");
		fireEvent.keyDown(menu, { key: "ArrowDown" });
		await waitFor(() =>
			expect(menu.getAttribute("aria-activedescendant")).toContain("rule-spam"),
		);
		fireEvent.keyDown(menu, { key: " " });
		await waitFor(() => expect(onRuleCheckedChange).toHaveBeenCalledWith(selected, true));
		expect(screen.getByRole("menu")).toBeTruthy();

		view.rerender(
			<ContentRuleMultiSelect
				destination={destinations[0]}
				labels={ruleLabels}
				onClear={onClear}
				onRuleCheckedChange={onRuleCheckedChange}
				selectedKeys={[selected]}
				totalSelectedCount={1}
			/>,
		);

		expect(screen.getByRole("button", { name: "適用規則" }).textContent).toContain(
			"禁止垃圾內容",
		);
		const clear = screen.getByRole("menuitem", { name: "清除已選規則" });
		expect(clear.hasAttribute("data-disabled")).toBe(false);
		fireEvent.pointerMove(clear, { pointerType: "mouse" });
		await waitFor(() =>
			expect(menu.getAttribute("aria-activedescendant")).toContain(
				"clear-content-governance-rules",
			),
		);
		fireEvent.click(clear);
		await waitFor(() => expect(onClear).toHaveBeenCalledOnce());
	});

	it("enforces the 32-rule limit without disabling selected rules", async () => {
		const rules = Array.from({ length: 33 }, (_, index) => ({
			id: `rule-${index}`,
			language: "zh" as const,
			title: `規則 ${index + 1}`,
		}));
		const options = [
			{
				id: "many-rules",
				scope: "realm" as const,
				language: "zh" as const,
				title: "大量規則",
				revisionId: "many-rules-revision",
				rules,
			},
		] satisfies GetApiReportsUnitsByUnitIdDestinationsStatus200["items"];
		const selectedKeys = rules
			.slice(0, 32)
			.map((rule) => ruleKey("many-rules", "many-rules-revision", rule.id));

		renderRuleSelector(selectedKeys, options);
		fireEvent.click(screen.getByRole("button", { name: "適用規則" }));

		const items = await screen.findAllByRole("menuitemcheckbox");
		expect(items).toHaveLength(33);
		expect(items[0]?.hasAttribute("data-disabled")).toBe(false);
		expect(items[32]?.hasAttribute("data-disabled")).toBe(true);
	});
});
