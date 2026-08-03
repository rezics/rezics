/** @vitest-environment jsdom */

import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FeedContinuation } from "./feed-continuation";

vi.mock("@/i18n/client", () => {
	return {
		useTranslation: () => ({
			t: {
				actions: { loadMore: "Load more", retry: "Retry" },
				state: { error: "Error" },
			},
		}),
	};
});

let emitIntersection: ((isIntersecting: boolean) => void) | undefined;
const observe = vi.fn();
const disconnect = vi.fn();
const observerOptions = vi.fn();

function ContainedFeedContinuation({ loadNext }: { readonly loadNext: () => void }) {
	const scrollRootRef = useRef<HTMLDivElement>(null);
	return (
		<div data-testid="feed-scroll-root" ref={scrollRootRef}>
			<FeedContinuation
				mode="infinite"
				scrollRootRef={scrollRootRef}
				state={{ status: "ready", loadNext }}
			/>
		</div>
	);
}

function InvalidContainedFeedContinuation({ loadNext }: { readonly loadNext: () => void }) {
	const scrollRootRef = useRef<HTMLDivElement>(null);
	return (
		<>
			<div ref={scrollRootRef} />
			<FeedContinuation
				mode="infinite"
				scrollRootRef={scrollRootRef}
				state={{ status: "ready", loadNext }}
			/>
		</>
	);
}

beforeEach(() => {
	emitIntersection = undefined;
	observe.mockClear();
	disconnect.mockClear();
	observerOptions.mockClear();
	vi.stubGlobal(
		"IntersectionObserver",
		class IntersectionObserverMock {
			constructor(
				callback: IntersectionObserverCallback,
				options?: IntersectionObserverInit,
			) {
				observerOptions(options);
				emitIntersection = (isIntersecting) =>
					callback(
						[{ isIntersecting } as IntersectionObserverEntry],
						this as unknown as IntersectionObserver,
					);
			}

			observe = observe;
			disconnect = disconnect;
			unobserve() {}
		},
	);
});

afterEach(() => {
	cleanup();
	vi.unstubAllGlobals();
});

describe("FeedContinuation", () => {
	it("preloads an infinite feed once per ready state and retains a manual fallback", () => {
		const loadNext = vi.fn();
		const view = render(
			<FeedContinuation mode="infinite" state={{ status: "ready", loadNext }} />,
		);

		expect(screen.getByRole("button", { name: "Load more" })).toBeDefined();
		expect(observerOptions).toHaveBeenCalledWith({
			root: null,
			rootMargin: "0px 0px 320px 0px",
		});

		act(() => {
			emitIntersection?.(true);
			emitIntersection?.(true);
		});
		expect(loadNext).toHaveBeenCalledTimes(1);

		view.rerender(<FeedContinuation mode="infinite" state={{ status: "loading" }} />);
		view.rerender(<FeedContinuation mode="infinite" state={{ status: "ready", loadNext }} />);
		act(() => emitIntersection?.(true));
		expect(loadNext).toHaveBeenCalledTimes(2);
	});

	it("observes the sentinel against its feed scroll container", () => {
		const loadNext = vi.fn();
		render(<ContainedFeedContinuation loadNext={loadNext} />);

		expect(observerOptions).toHaveBeenCalledWith({
			root: screen.getByTestId("feed-scroll-root"),
			rootMargin: "0px 0px 320px 0px",
		});
		act(() => emitIntersection?.(true));
		expect(loadNext).toHaveBeenCalledOnce();
	});

	it("does not fall back to the page viewport when the declared root is invalid", () => {
		const loadNext = vi.fn();
		render(<InvalidContainedFeedContinuation loadNext={loadNext} />);

		expect(observerOptions).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(loadNext).toHaveBeenCalledOnce();
	});

	it("loads only from user activation in load-more mode", () => {
		const loadNext = vi.fn();
		render(<FeedContinuation mode="load-more" state={{ status: "ready", loadNext }} />);

		expect(observe).not.toHaveBeenCalled();
		fireEvent.click(screen.getByRole("button", { name: "Load more" }));
		expect(loadNext).toHaveBeenCalledOnce();
	});

	it("renders a next-page retry action", () => {
		const retry = vi.fn();
		render(<FeedContinuation mode="infinite" state={{ status: "error", retry }} />);

		fireEvent.click(screen.getByRole("button", { name: "Retry" }));
		expect(retry).toHaveBeenCalledOnce();
	});
});
