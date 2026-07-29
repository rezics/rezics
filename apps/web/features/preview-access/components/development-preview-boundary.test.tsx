/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	session: { data: { user: { id: "viewer" } }, isPending: false },
	profile: {
		data: { platformCapabilities: [] as string[] },
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	},
}));

vi.mock("@/lib/use-hydrated-session", () => ({
	useHydratedSession: () => mocks.session,
}));
vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiUsersMe: () => mocks.profile,
}));
vi.mock("./preview-access-notice", () => ({
	PreviewAccessNotice: () => <div>preview-access-notice</div>,
}));
vi.mock("@rezics/ui", () => ({
	QueryFailure: () => <div>query-failure</div>,
	QueryPending: () => <div>query-pending</div>,
}));

import { DevelopmentPreviewBoundary } from "./development-preview-boundary";

const renderProtectedContent = vi.fn();

function ProtectedContent() {
	renderProtectedContent();
	return <div>zone-content</div>;
}

describe("DevelopmentPreviewBoundary", () => {
	afterEach(cleanup);

	beforeEach(() => {
		renderProtectedContent.mockClear();
		mocks.session.data = { user: { id: "viewer" } };
		mocks.session.isPending = false;
		mocks.profile.data.platformCapabilities = [];
		mocks.profile.error = null;
		mocks.profile.isError = false;
		mocks.profile.isPending = false;
	});

	it("shows the development notice without the required capability", () => {
		render(
			<DevelopmentPreviewBoundary>
				<ProtectedContent />
			</DevelopmentPreviewBoundary>,
		);

		expect(screen.getByText("preview-access-notice")).toBeTruthy();
		expect(screen.queryByText("zone-content")).toBeNull();
		expect(renderProtectedContent).not.toHaveBeenCalled();
	});

	it("renders protected content when the capability is present", () => {
		mocks.profile.data.platformCapabilities = ["platform.development_preview.access"];
		render(
			<DevelopmentPreviewBoundary>
				<ProtectedContent />
			</DevelopmentPreviewBoundary>,
		);

		expect(screen.getByText("zone-content")).toBeTruthy();
		expect(screen.queryByText("preview-access-notice")).toBeNull();
		expect(renderProtectedContent).toHaveBeenCalledOnce();
	});
});
