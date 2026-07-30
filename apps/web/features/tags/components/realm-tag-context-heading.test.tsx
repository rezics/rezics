/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { AnchorHTMLAttributes, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({
		children,
		...props
	}: AnchorHTMLAttributes<HTMLAnchorElement> & {
		readonly children?: ReactNode;
	}) => <a {...props}>{children}</a>,
}));

vi.mock("@rezics/ui", async (importOriginal) => {
	const actual = await importOriginal<typeof import("@rezics/ui")>();
	return {
		...actual,
		HoverCard: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
		HoverCardTrigger: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
		HoverCardContent: ({ children }: { readonly children: ReactNode }) => (
			<div data-testid="hover-card-content">{children}</div>
		),
	};
});

import { RealmTagContextHeading } from "./realm-tag-context-heading";

afterEach(cleanup);

describe("RealmTagContextHeading", () => {
	it("links the compact Realm identity and supplies its complete hover card", () => {
		render(
			<RealmTagContextHeading
				fallbackTitle="Unnamed Realm"
				realm={{
					realmId: "019b76da-a800-7300-8000-000000000001",
					language: "en",
					title: "Readers",
					summary: "A Realm for people who read together.",
					avatar: { type: "emoji", emoji: "📚" },
				}}
			/>,
		);

		const link = screen.getByRole("link", { name: "Readers" });
		expect(link.getAttribute("href")).toBe("/realm/019b76da-a800-7300-8000-000000000001");
		expect(link.querySelector('[data-slot="avatar"]')?.className).toContain("size-6");

		const hoverCard = screen.getByTestId("hover-card-content");
		expect(hoverCard.querySelector('[data-slot="realm-info-card"]')).toBeTruthy();
		expect(hoverCard.textContent).toContain("Readers");
		expect(hoverCard.textContent).toContain("A Realm for people who read together.");
	});
});
