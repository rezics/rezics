/** @vitest-environment jsdom */

import { Suspense, useState } from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const frameworkRouter = vi.hoisted(() => ({
	back: vi.fn(),
	forward: vi.fn(),
	prefetch: vi.fn(),
	push: vi.fn(),
	refresh: vi.fn(),
	replace: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => frameworkRouter,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ t: { state: { loading: "Loading…" } } }),
}));

import { NavigationProgressProvider } from "../navigation-progress";
import { useApplicationRouter } from "./use-application-router";

let commitDestination: (() => void) | undefined;
let destinationReady = false;
let destinationPromise: Promise<void>;
let resolveDestination: (() => void) | undefined;

function RouterProbe() {
	const [route, setRoute] = useState<"current" | "destination">("current");
	const router = useApplicationRouter();
	commitDestination = () => setRoute("destination");

	if (route === "destination" && !destinationReady) throw destinationPromise;

	return (
		<button onClick={() => router.push("/destination")} type="button">
			Navigate
		</button>
	);
}

beforeEach(() => {
	destinationReady = false;
	destinationPromise = new Promise((resolve) => {
		resolveDestination = resolve;
	});
	frameworkRouter.push.mockReset();
	frameworkRouter.push.mockImplementation(() => commitDestination?.());
	vi.useFakeTimers();
});

afterEach(() => {
	commitDestination = undefined;
	resolveDestination = undefined;
	cleanup();
	vi.useRealTimers();
});

describe("useApplicationRouter", () => {
	it("keeps programmatic navigation pending until its transition commits", async () => {
		render(
			<NavigationProgressProvider>
				<Suspense fallback={<span>Fallback</span>}>
					<RouterProbe />
				</Suspense>
			</NavigationProgressProvider>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Navigate" }));
		expect(frameworkRouter.push).toHaveBeenCalledWith("/destination", undefined);

		act(() => vi.advanceTimersByTime(100));
		expect(screen.getByRole("status").textContent).toBe("Loading…");
		expect(screen.queryByText("Fallback")).toBeNull();

		destinationReady = true;
		await act(async () => resolveDestination?.());
		expect(screen.queryByRole("status")).toBeNull();
	});
});
