/** @vitest-environment jsdom */

import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ChapterReadingProgress } from "./chapter-reading-progress";

const state = vi.hoisted(() => ({
	authenticated: true,
	invalidate: vi.fn(() => Promise.resolve()),
	mutate: vi.fn(),
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => ({ data: state.authenticated ? { user: { id: "viewer" } } : null }),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({}),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	usePostApiProgressByUnitIdNodesByNodeIdRead: () => ({ mutate: state.mutate }),
}));

vi.mock("../data/progress-cache", () => ({
	invalidateProgressQueries: state.invalidate,
}));

function setVisibility(value: DocumentVisibilityState) {
	Object.defineProperty(document, "visibilityState", { configurable: true, value });
}

beforeEach(() => {
	state.authenticated = true;
	state.invalidate.mockClear();
	state.mutate.mockClear();
	setVisibility("visible");
});

afterEach(cleanup);

describe("ChapterReadingProgress", () => {
	it("records a successfully loaded visible chapter once", () => {
		const view = render(<ChapterReadingProgress nodeId="node" unitId="book" />);

		expect(state.mutate).toHaveBeenCalledOnce();
		expect(state.mutate).toHaveBeenCalledWith({ path: { nodeId: "node", unitId: "book" } });

		view.rerender(<ChapterReadingProgress nodeId="node" unitId="book" />);
		act(() => document.dispatchEvent(new Event("visibilitychange")));
		expect(state.mutate).toHaveBeenCalledOnce();
	});

	it("waits until a hidden chapter becomes visible", () => {
		setVisibility("hidden");
		render(<ChapterReadingProgress nodeId="node" unitId="book" />);
		expect(state.mutate).not.toHaveBeenCalled();

		setVisibility("visible");
		act(() => document.dispatchEvent(new Event("visibilitychange")));
		expect(state.mutate).toHaveBeenCalledOnce();
	});

	it("does not write progress for an anonymous reader", () => {
		state.authenticated = false;
		render(<ChapterReadingProgress nodeId="node" unitId="book" />);

		expect(state.mutate).not.toHaveBeenCalled();
	});
});
