// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { RealmTagVoteContextPresentation } from "../model/tag-presentation";

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	useChineseContentTexts: (entries: readonly { readonly value: string }[]) =>
		entries.map(({ value }) => value),
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			state: { empty: "No results" },
			tags: {
				global: { title: "Global context" },
				unnamedRealm: "Unnamed Realm",
				voteContext: { select: "Choose a voting context" },
			},
			ui: { pickerPlaceholders: { realm: "Enter a Realm name" } },
		},
	}),
}));

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal("CSS", { escape: (value: string) => value });

import { TagVoteContextSelector } from "./tag-vote-context-selector";

const realms = [
	{
		realmId: "00000000-0000-7000-8000-000000000001",
		language: null,
		title: "Blue Realm",
		summary: "Ocean research",
		avatar: null,
	},
	{
		realmId: "00000000-0000-7000-8000-000000000002",
		language: null,
		title: "Green Realm",
		summary: "Forest research",
		avatar: null,
	},
] as const satisfies readonly RealmTagVoteContextPresentation[];

describe("TagVoteContextSelector", () => {
	afterEach(cleanup);

	it("filters eligible contexts by localized title or summary and commits the exact option", async () => {
		const onValueChange = vi.fn();
		render(
			<TagVoteContextSelector
				onValueChange={onValueChange}
				realms={realms}
				value={{ kind: "global" }}
			/>,
		);

		const input = screen.getByRole("combobox", { name: "Choose a voting context" });
		expect(input).toHaveProperty("value", "Global context");
		fireEvent.click(input);
		await waitFor(() => expect(input).toHaveProperty("value", ""));

		fireEvent.change(input, { target: { value: "ocean" } });
		expect(await screen.findByText("Blue Realm")).toBeTruthy();
		expect(screen.queryByText("Green Realm")).toBeNull();
		expect(screen.queryByText("Global context")).toBeNull();

		const option = screen.getByText("Blue Realm").closest('[role="option"]');
		if (!option) throw new Error("Expected the matching Realm option to be rendered.");
		fireEvent.click(option);

		await waitFor(() =>
			expect(onValueChange).toHaveBeenCalledWith({
				kind: "realm",
				realm: realms[0],
			}),
		);
	});
});
