/** @vitest-environment jsdom */

import { forwardRef, type AnchorHTMLAttributes, type ReactNode } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const linkState = vi.hoisted(() => ({ pending: false }));
const authPortalState = vi.hoisted(() => ({
	openAuthPortal: vi.fn(),
}));

vi.mock("next/link", () => ({
	default: forwardRef<
		HTMLAnchorElement,
		AnchorHTMLAttributes<HTMLAnchorElement> & {
			readonly children?: ReactNode;
			readonly href: string;
		}
	>(function LinkMock({ children, href, ...props }, ref) {
		return (
			<a {...props} href={href} ref={ref}>
				{children}
			</a>
		);
	}),
	useLinkStatus: () => ({ pending: linkState.pending }),
}));

vi.mock("@/features/auth/auth-portal-context", () => ({
	useOptionalAuthPortal: () => authPortalState,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: { state: { loading: "Loading…" } } }),
}));

import { NavigationProgressProvider } from "../navigation-progress";
import { AppLink } from "./app-link";

beforeEach(() => {
	linkState.pending = false;
	authPortalState.openAuthPortal.mockReset();
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("AppLink", () => {
	it.each([
		{ href: "/login", mode: "login", options: undefined },
		{ href: "/login?next=%2Fcreate", mode: "login", options: { destination: "/create" } },
		{ href: "/register", mode: "register", options: undefined },
	] as const)("opens the $mode portal without route navigation", ({ href, mode, options }) => {
		render(
			<NavigationProgressProvider>
				<AppLink href={href}>Authentication</AppLink>
			</NavigationProgressProvider>,
		);

		expect(fireEvent.click(screen.getByRole("link", { name: "Authentication" }))).toBe(false);
		expect(authPortalState.openAuthPortal).toHaveBeenCalledExactlyOnceWith(mode, options);
	});

	it("reports the enclosing Next Link pending lifecycle", () => {
		const view = render(
			<NavigationProgressProvider>
				<AppLink href="/destination">Destination</AppLink>
			</NavigationProgressProvider>,
		);

		linkState.pending = true;
		view.rerender(
			<NavigationProgressProvider>
				<AppLink href="/destination">Destination</AppLink>
			</NavigationProgressProvider>,
		);
		act(() => vi.advanceTimersByTime(100));
		expect(screen.getByRole("status").textContent).toBe("Loading…");

		linkState.pending = false;
		view.rerender(
			<NavigationProgressProvider>
				<AppLink href="/destination">Destination</AppLink>
			</NavigationProgressProvider>,
		);
		expect(screen.queryByRole("status")).toBeNull();
	});
});
