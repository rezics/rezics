/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StudioOverviewPage } from "./studio-overview-page";

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: { create: { workspace: { overview: "Studio sections" } } },
	}),
}));

vi.mock("../components/studio-workspace", () => ({
	useStudioWorkspaceSections: () => [
		{
			id: "post",
			href: "/create/post",
			label: "Posts",
			description: "View and manage posts.",
			icon: () => null,
		},
		{
			id: "book",
			href: "/create/book",
			label: "Books",
			description: "View and manage books.",
			icon: () => null,
		},
	],
}));

afterEach(cleanup);

describe("StudioOverviewPage", () => {
	it("uses the same section destinations as the workspace navigation", () => {
		render(<StudioOverviewPage />);

		const navigation = screen.getByRole("navigation", { name: "Studio sections" });
		expect(navigation.querySelectorAll('a[href$="/new"]')).toHaveLength(0);
		expect(screen.getByRole("link", { name: /Posts/ }).getAttribute("href")).toBe("/create/post");
		expect(screen.getByRole("link", { name: /Books/ }).getAttribute("href")).toBe("/create/book");
	});
});
