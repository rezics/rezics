/** @vitest-environment jsdom */

import type { GetApiEntitiesByUnitIdStatus200 } from "@rezics/openapi-tanstack-query";
import { cleanup, render, screen } from "@testing-library/react";
import { cloneElement, isValidElement, type ComponentProps, type ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	entity: undefined as GetApiEntitiesByUnitIdStatus200 | undefined,
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiEntitiesByUnitId: () => ({
		data: state.entity,
		error: null,
		isError: false,
		isPending: false,
		refetch: vi.fn(),
	}),
}));

vi.mock("@rezics/ui", () => ({
	Banner: ({ src }: { readonly src: string }) => <div data-banner-src={src} />,
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
	Card: ({ children }: { readonly children: ReactNode }) => <section>{children}</section>,
	CardContent: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	Cover: ({ alt, src }: { readonly alt: string; readonly src: string }) => (
		<img alt={alt} data-testid="entity-cover" src={src} />
	),
	IdentityAvatar: () => <div data-testid="entity-avatar" />,
	PageHeading: ({ title }: { readonly title: string }) => <h1>{title}</h1>,
	QueryFailure: () => <div>Failure</div>,
	QueryPending: () => <div>Pending</div>,
	ShowMoreContent: ({ children }: { readonly children: ReactNode }) => <>{children}</>,
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

vi.mock("@/features/content-language-display/localized-portable-text-content", () => ({
	LocalizedPortableTextContent: ({ value }: { readonly value: unknown }) => (
		<div data-testid="entity-description">{JSON.stringify(value)}</div>
	),
}));

vi.mock("@/features/content-languages/components/content-language-version-menu", () => ({
	ContentLanguageVersionMenu: () => null,
}));

vi.mock("@/features/ownership-claims/components/unit-ownership-claim-actions", () => ({
	EntityOwnershipClaimButton: () => null,
}));

vi.mock("@/features/reports/components/unit-report-dialog", () => ({
	UnitReportOverflowMenu: () => null,
}));

vi.mock("@/features/tags/components/unit-tag-summary", () => ({
	UnitTagSummary: ({ type, unitId }: { readonly type: string; readonly unitId: string }) => (
		<div data-testid="entity-tags">{`${type}:${unitId}`}</div>
	),
}));

vi.mock("@/features/units/components/unit-variant-list", () => ({
	UnitVariantList: ({ context }: { readonly context: { readonly role: string } }) => (
		<div data-testid="entity-variants">{context.role}</div>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			entities: {
				kind: "Kind",
				owner: "Owner",
				unverified: "Unverified",
				verification: "Verification",
				verified: "Verified",
			},
			governance: { open: "Governance" },
			ui: {
				character: "Character",
				edit: "Edit",
				showLess: "Show less",
				showMore: "Show more",
				unnamed: "Unnamed",
			},
		},
	}),
}));

vi.mock("@/i18n/use-localization-fallback-toast", () => ({
	useLocalizationFallbackToast: () => undefined,
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["en"],
}));

vi.mock("../components/entity-external-links", () => ({
	EntityExternalLinks: () => null,
}));

vi.mock("../components/entity-related-feed", () => ({
	EntityRelatedFeed: () => null,
}));

import { EntityDetailPage } from "./entity-detail-page";

const EntityId = "00000000-0000-7000-8000-000000000001";
const CreatedAt = "2026-08-20T00:00:00.000Z";
const entity = {
	id: EntityId,
	kind: "character",
	verified: true,
	ownershipMode: "community_owned",
	ownershipClaim: null,
	language: "en",
	avatar: null,
	banner: null,
	cover: { id: "fallback-cover", url: "https://example.com/fallback-cover.webp" },
	createdAt: CreatedAt,
	updatedAt: CreatedAt,
	localizations: [
		{
			unitId: EntityId,
			language: "en",
			position: "a0",
			title: "Saber",
			summary: "A principal character.",
			description: {
				_type: "portable-text",
				_key: "111111111111",
				content: [
					{
						_key: "description-block",
						_type: "block",
						children: [
							{
								_key: "description-span",
								_type: "span",
								text: "A legendary king.",
								marks: [],
							},
						],
						markDefs: [],
						style: "normal",
					},
				],
			},
			avatar: { type: "emoji", emoji: "⚔️" },
			banner: null,
			cover: { id: "localized-cover", url: "https://example.com/localized-cover.webp" },
			createdAt: CreatedAt,
			updatedAt: CreatedAt,
		},
	],
	attributions: [],
	owner: null,
	externalLinks: [],
	variantContext: {
		role: "main",
		variants: [
			{
				id: "00000000-0000-7000-8000-000000000002",
				type: "entity",
				language: "en",
				title: "Saber Alter",
				cover: null,
			},
		],
	},
	capabilities: {
		canEdit: true,
		canEditCreditAttributions: false,
		canCurateTags: false,
		canManageVariants: false,
		canManageAccess: false,
		canManageCreditAssociations: false,
		canManageSubjectAssociations: false,
	},
	creditAttributions: [],
	subjectAssociations: [],
} satisfies GetApiEntitiesByUnitIdStatus200;

afterEach(() => {
	cleanup();
	state.entity = undefined;
});

describe("EntityDetailPage", () => {
	it("renders the selected localization's cover and full description", () => {
		state.entity = entity;

		render(<EntityDetailPage id={EntityId} />);

		expect(screen.getByRole("heading", { name: "Saber" })).toBeTruthy();
		expect(screen.getByText("A principal character.")).toBeTruthy();
		expect(screen.getByTestId("entity-cover").getAttribute("src")).toBe(
			"https://example.com/localized-cover.webp",
		);
		expect(screen.getByTestId("entity-description").textContent).toContain("A legendary king.");
		expect(screen.getByTestId("entity-tags").textContent).toBe(`entity:${EntityId}`);
		expect(screen.getByTestId("entity-variants").textContent).toBe("main");
	});
});
