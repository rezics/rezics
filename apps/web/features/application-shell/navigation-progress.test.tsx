/** @vitest-environment jsdom */

import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: { state: { loading: "Loading…" } } }),
}));

import { NavigationProgressProvider } from "./navigation-progress";
import { useNavigationProgressSignal } from "./navigation-progress-context";

function ProgressSignal({ pending }: { readonly pending: boolean }) {
	useNavigationProgressSignal(pending);
	return null;
}

function ProgressScenario({
	first,
	second = false,
}: {
	readonly first: boolean;
	readonly second?: boolean;
}) {
	return (
		<NavigationProgressProvider>
			<ProgressSignal pending={first} />
			<ProgressSignal pending={second} />
		</NavigationProgressProvider>
	);
}

beforeEach(() => {
	vi.useFakeTimers();
});

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

describe("navigation progress", () => {
	it("does not flash for navigation that settles inside the display delay", () => {
		const view = render(<ProgressScenario first />);
		view.rerender(<ProgressScenario first={false} />);

		act(() => vi.advanceTimersByTime(100));

		expect(screen.queryByRole("status")).toBeNull();
		expect(document.querySelector('[data-slot="progress"]')).toBeNull();
	});

	it("shows indeterminate progress, then completes only after navigation settles", () => {
		const view = render(<ProgressScenario first />);

		act(() => vi.advanceTimersByTime(99));
		expect(screen.queryByRole("status")).toBeNull();

		act(() => vi.advanceTimersByTime(1));
		expect(screen.getByRole("status").textContent).toBe("Loading…");
		expect(document.querySelector('[data-slot="progress"]')).not.toBeNull();

		view.rerender(<ProgressScenario first={false} />);
		expect(screen.queryByRole("status")).toBeNull();
		expect(document.querySelector('[data-slot="progress"]')).not.toBeNull();

		act(() => vi.advanceTimersByTime(225));
		expect(document.querySelector('[data-slot="progress"]')).toBeNull();
	});

	it("keeps progress active until every overlapping navigation settles", () => {
		const view = render(<ProgressScenario first second />);
		act(() => vi.advanceTimersByTime(100));
		expect(screen.getByRole("status")).toBeTruthy();

		view.rerender(<ProgressScenario first={false} second />);
		expect(screen.getByRole("status")).toBeTruthy();

		view.rerender(<ProgressScenario first={false} second={false} />);
		expect(screen.queryByRole("status")).toBeNull();
	});
});
