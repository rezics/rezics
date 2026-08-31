/** @vitest-environment jsdom */

import type { MenuBlock } from "@rezics/block";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => {
	const Container = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Button: Container,
		IdentityAvatar: ({
			className,
			fallback,
		}: {
			readonly className?: string;
			readonly fallback: string;
		}) => (
			<span className={className} data-testid="zone-avatar">
				{fallback}
			</span>
		),
		Popover: Container,
		PopoverContent: Container,
		PopoverTrigger: ({
			"aria-label": ariaLabel,
			children,
			className,
		}: {
			readonly "aria-label": string;
			readonly children?: ReactNode;
			readonly className?: string;
		}) => (
			<button aria-label={ariaLabel} className={className} type="button">
				{children}
			</button>
		),
		cn: (...classes: unknown[]) =>
			classes.filter((value): value is string => typeof value === "string").join(" "),
	};
});

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
		<a href={href}>{children}</a>
	),
}));

vi.mock("@/features/following/components/follow-button", () => ({
	FollowButton: ({ size, unitId }: { readonly size: string; readonly unitId: string }) => (
		<button data-size={size} data-testid="follow-button" data-unit-id={unitId} type="button" />
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			management: { title: "Manage" },
			navigation: "Zone navigation",
			openNavigation: "Open Zone navigation",
		},
	}),
}));

vi.mock("./block-renderer", () => ({
	ZoneDocument: ({
		blocks,
		navigationLayout,
	}: {
		readonly blocks: readonly MenuBlock[];
		readonly navigationLayout: string;
	}) => (
		<div
			data-block-keys={blocks.map(({ _key }) => _key).join(",")}
			data-layout={navigationLayout}
			data-testid="zone-menu-document"
		/>
	),
}));

import { ZoneHeader } from "./zone-header";

const ZoneId = "019f9000-0000-7000-8000-000000000001";
const Menu = {
	_type: "menu",
	_key: "000000000001",
	appearance: "links",
	navigationId: "019f9000-0000-7000-8000-000000000002",
	orientation: "horizontal",
} satisfies MenuBlock;

afterEach(() => {
	cleanup();
	Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
});

describe("Zone platform header", () => {
	it("renders sticky identity, desktop and mobile navigation, and platform actions", () => {
		const { container } = render(
			<ZoneHeader avatar={null} canManage menuBlocks={[Menu]} title="Zone title" zoneId={ZoneId} />,
		);

		const platformHeader = container.querySelector('[data-zone-part="platform-header"]');
		expect(platformHeader?.className).toContain("sticky");
		expect(platformHeader?.className).toContain("top-28");
		expect(screen.getByText("Zone title")).not.toBeNull();
		expect(screen.getByTestId("zone-avatar").textContent).toBe("Z");
		expect(screen.getByRole("button", { name: "Open Zone navigation" })).not.toBeNull();
		expect(
			screen.getAllByTestId("zone-menu-document").map(({ dataset }) => dataset.layout),
		).toEqual(["vertical", "horizontal"]);
		expect(screen.getByText("Manage").closest("a")?.getAttribute("href")).toBe(
			`/zone/${ZoneId}/manage`,
		);
		expect(screen.getByTestId("follow-button").getAttribute("data-unit-id")).toBe(ZoneId);
	});

	it("uses compact controls after the page scrolls", async () => {
		render(
			<ZoneHeader
				avatar={null}
				canManage={false}
				menuBlocks={[Menu]}
				title="Zone title"
				zoneId={ZoneId}
			/>,
		);

		Object.defineProperty(window, "scrollY", { configurable: true, value: 80 });
		window.dispatchEvent(new Event("scroll"));

		await waitFor(() => expect(screen.getByTestId("zone-avatar").className).toContain("size-9"));
		expect(screen.getByTestId("follow-button").getAttribute("data-size")).toBe("sm");
	});
});
