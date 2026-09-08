/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => ({
	Button: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	PageHeading: ({ title }: { readonly title: string }) => <h1>{title}</h1>,
	QueryFailure: () => <div>query-failure</div>,
	QueryPending: () => <div>query-pending</div>,
}));
vi.mock("lucide-react", () => ({
	ArrowLeft: () => <svg aria-hidden />,
}));
vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href }: { readonly children: ReactNode; readonly href: string }) => (
		<a href={href}>{children}</a>
	),
}));
vi.mock("@/features/preview-access/components/preview-access-notice", () => ({
	PreviewAccessNotice: () => <div>preview-access-notice</div>,
}));
vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			engagement: { questions: "Questions" },
			ui: { unnamed: "Unnamed" },
			units: { detail: { backToOverview: "Back to overview" } },
		},
	}),
}));
vi.mock("@/features/units/hooks/use-unit-summary", () => ({
	useUnitSummary: () => ({
		data: {
			id: "unit-id",
			owner: "publishing",
			shape: "work",
			language: "en",
			title: "Example work",
			summary: null,
			avatar: null,
		},
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

import { UnitQuestionsPage } from "./unit-questions-page";

describe("UnitQuestionsPage", () => {
	afterEach(cleanup);

	it("uses the shared preview access notice for the unreleased questions feature", () => {
		render(<UnitQuestionsPage type="publishing" unitId="unit-id" />);

		expect(screen.getByText("preview-access-notice")).toBeTruthy();
	});
});
