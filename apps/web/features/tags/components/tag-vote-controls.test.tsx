/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
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
});
