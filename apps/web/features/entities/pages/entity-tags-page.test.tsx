/** @vitest-environment jsdom */

import { cleanup, render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const EntityId = "00000000-0000-7000-8000-000000000001";

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiEntitiesByUnitId: () => ({
		data: {
			id: EntityId,
			language: "en",
			localizations: [{ language: "en", title: "Saber" }],
		},
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@rezics/ui", () => ({
	Alert: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	AlertDescription: ({ children }: { readonly children: ReactNode }) => <p>{children}</p>,
	Button: ({
		asChild,
		children,
		...props
	}: ComponentProps<"button"> & { readonly asChild?: boolean }) =>
		asChild && isValidElement(children) ? (
			cloneElement(children, props)
		) : (
			<button type="button" {...props}>
				{children}
			</button>
		),
	PageHeading: ({
		description,
		title,
	}: {
		readonly description?: string;
		readonly title: string;
	}) => (
		<header>
			<h1>{title}</h1>
			{description ? <p>{description}</p> : null}
		</header>
	),
	QueryFailure: () => <div>Failure</div>,
	QueryPending: () => <div>Pending</div>,
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/features/content-language-display/chinese-content-display-context", () => ({
	useChineseContentText: (value: string) => value,
}));

vi.mock("@/features/tags/components/unit-tag-explorer", () => ({
	UnitTagExplorer: ({
		highlightedTagId,
		type,
		unitId,
	}: {
		readonly highlightedTagId?: string;
		readonly type: string;
		readonly unitId: string;
	}) => <div data-testid="tag-explorer">{`${type}:${unitId}:${highlightedTagId ?? ""}`}</div>,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				create: { completed: "Tag created" },
				page: { description: "Explore this Entity's Tags", title: "Tags" },
			},
			ui: { unnamed: "Unnamed" },
			units: { detail: { backToOverview: "Back to overview" } },
		},
	}),
}));

vi.mock("@/i18n/use-localization-fallback-toast", () => ({
	useLocalizationFallbackToast: () => undefined,
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

vi.mock("@/lib/localization", () => ({
	selectLocalization: (
		localizations: readonly { readonly language: string; readonly title: string }[],
	) => localizations[0] ?? null,
}));

import { EntityTagsPage } from "./entity-tags-page";

afterEach(cleanup);

describe("EntityTagsPage", () => {
	it("keeps Entity navigation and Tag exploration on Entity routes", () => {
		render(
			<EntityTagsPage
				entityId={EntityId}
				routeState={{
					context: { kind: "global" },
					createdTagId: "00000000-0000-7000-8000-000000000002",
				}}
			/>,
		);

		expect(screen.getByRole("heading", { name: "Tags" })).toBeTruthy();
		expect(screen.getByText("Saber")).toBeTruthy();
		expect(screen.getByRole("link", { name: /Back to overview/ }).getAttribute("href")).toBe(
			`/entities/${EntityId}`,
		);
		expect(screen.getByTestId("tag-explorer").textContent).toBe(
			`entity:${EntityId}:00000000-0000-7000-8000-000000000002`,
		);
		expect(screen.getByText("Tag created")).toBeTruthy();
	});
});
