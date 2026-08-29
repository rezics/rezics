/** @vitest-environment jsdom */

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => ({
	Button: ({
		children,
		...props
	}: ButtonHTMLAttributes<HTMLButtonElement> & { readonly children: ReactNode }) => (
		<button {...props}>{children}</button>
	),
	cn: (...values: unknown[]) => values.filter(Boolean).join(" "),
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				vote: {
					fits: "Fits",
					doesNotFit: "Does not fit",
					clear: "Clear",
					summary: ({ score, count }: { score: string; count: string }) => `${score} / ${count}`,
				},
				paths: {
					spoilerLabel: "Spoiler level",
					spoilerNone: "None",
					spoilerMinor: "Minor",
					spoilerMajor: "Major",
				},
			},
		},
	}),
}));

import { TagVoteControls } from "./tag-vote-controls";

afterEach(cleanup);

describe("TagVoteControls", () => {
	it("shows the vote summary but renders no vote buttons without permission", () => {
		render(
			<TagVoteControls
				canVote={false}
				isPending={false}
				onClear={vi.fn()}
				onVote={vi.fn()}
				score={3}
				viewerVote={null}
				voteCount={5}
			/>,
		);

		expect(screen.getByText("3 / 5")).toBeTruthy();
		expect(screen.queryByRole("button")).toBeNull();
	});

	it("toggles an independent spoiler judgment without changing fit", () => {
		const onSpoilerChange = vi.fn();
		const onVote = vi.fn();
		render(
			<TagVoteControls
				canVote
				isPending={false}
				onClear={vi.fn()}
				onSpoilerChange={onSpoilerChange}
				onVote={onVote}
				score={3}
				viewerSpoilerLevel={1}
				viewerVote={1}
				voteCount={5}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Major" }));
		expect(onSpoilerChange).toHaveBeenCalledWith(2);
		expect(onVote).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Minor" }));
		expect(onSpoilerChange).toHaveBeenLastCalledWith(null);
	});
});
