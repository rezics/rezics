/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { RealmRulesCard, type RealmRulePresentation } from "./realm-rules-card";

const rules = [
	{
		id: "rule-1",
		title: "Be civil",
		content: {
			_type: "portable-text",
			_key: "abcdef123456",
			content: [
				{
					_key: "block-1",
					_type: "block",
					style: "normal",
					children: [
						{
							_key: "span-1",
							_type: "span",
							text: "Treat other people with respect.",
							marks: [],
						},
					],
					markDefs: [],
				},
			],
		},
	},
	{
		id: "rule-2",
		title: "Stay on topic",
		content: {
			_type: "portable-text",
			_key: "abcdef654321",
			content: [
				{
					_key: "block-2",
					_type: "block",
					style: "normal",
					children: [
						{
							_key: "span-2",
							_type: "span",
							text: "Keep discussions relevant to the realm.",
							marks: [],
						},
					],
					markDefs: [],
				},
			],
		},
	},
	{
		id: "rule-3",
		title: "AnUninterruptedRuleTitleThatMustRemainInsideTheSidebarEvenWithoutNaturalBreakPoints",
		content: {
			_type: "portable-text",
			_key: "abcdef999999",
			content: [],
		},
	},
] satisfies readonly RealmRulePresentation[];

afterEach(cleanup);

describe("RealmRulesCard", () => {
	it("starts with every rule collapsed and expands rules independently", async () => {
		render(<RealmRulesCard rules={rules} title="Rules" />);

		const firstRule = screen.getByRole("button", { name: /Be civil/ });
		const secondRule = screen.getByRole("button", { name: /Stay on topic/ });

		expect(firstRule.getAttribute("aria-expanded")).toBe("false");
		expect(secondRule.getAttribute("aria-expanded")).toBe("false");
		expect(firstRule.getAttribute("data-variant")).toBe("ghost");
		expect(screen.queryByText("Treat other people with respect.")).toBeNull();

		fireEvent.click(firstRule);

		await waitFor(() =>
			expect(
				screen.getByRole("button", { name: /Be civil/ }).getAttribute("aria-expanded"),
			).toBe("true"),
		);
		expect(
			screen.getByRole("button", { name: /Stay on topic/ }).getAttribute("aria-expanded"),
		).toBe("false");
		expect(screen.getByText("Treat other people with respect.")).toBeTruthy();

		fireEvent.click(secondRule);

		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: /Be civil/ }).getAttribute("aria-expanded"),
			).toBe("true");
			expect(
				screen.getByRole("button", { name: /Stay on topic/ }).getAttribute("aria-expanded"),
			).toBe("true");
		});
		expect(screen.getByText("Keep discussions relevant to the realm.")).toBeTruthy();
	});

	it("allows long rule titles to wrap within the sidebar", () => {
		render(<RealmRulesCard rules={rules} title="Rules" />);

		const title = screen.getByText(
			"AnUninterruptedRuleTitleThatMustRemainInsideTheSidebarEvenWithoutNaturalBreakPoints",
		);
		const trigger = title.closest("button");

		expect(trigger).not.toBeNull();
		expect(trigger?.className).toContain("whitespace-normal");
		expect(trigger?.className).not.toContain("whitespace-nowrap");
		expect(title.className).toContain("break-words");
		expect(title.className).toContain("[overflow-wrap:anywhere]");
	});
});
