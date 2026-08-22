/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { UnitSubjectGroups } from "./unit-subject-groups";
import { UnitVariantList } from "./unit-variant-list";

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ href, ...props }: ComponentProps<"a"> & { readonly href: string }) => (
		<a href={href} {...props} />
	),
}));

vi.mock("@/features/content-feed/components/feed-card-actions", () => ({
	FeedOverflowMenu: () => <button type="button">More actions</button>,
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.stubGlobal(
	"ResizeObserver",
	class ResizeObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);
vi.stubGlobal(
	"IntersectionObserver",
	class IntersectionObserverMock {
		observe() {}
		unobserve() {}
		disconnect() {}
	},
);

const translation = await create(resources).getTranslation(
	["actions", "feed", "state", "tags", "ui", "units"],
	["en"],
);

afterEach(cleanup);

type SubjectAssociation = ComponentProps<typeof UnitSubjectGroups>["associations"][number];

const subjectAssociationTagId = "01941f29-7c00-7000-8000-000000000004";

const subjectAssociation = {
	id: "01941f29-7c00-7000-8000-000000000001",
	entityEntryId: "01941f29-7c00-7000-8000-000000000002",
	entityKind: "character",
	role: "primary_character",
	position: "a0",
	language: "en",
	title: "Emiya Shirou",
	summary: "A student who becomes involved in the Holy Grail War.",
	avatar: { type: "emoji", emoji: "E" },
	cover: {
		id: "01941f29-7c00-7000-8000-000000000003",
		url: "https://example.test/emiyashirou.webp",
	},
	tags: [
		{
			tagId: subjectAssociationTagId,
			title: "Red",
		},
	],
	contextPost: null,
} satisfies SubjectAssociation;

function renderWithTranslation(children: ReactNode) {
	return render(
		<TranslationProvider initial={translation.snapshot}>{children}</TranslationProvider>,
	);
}

describe("Unit association cards", () => {
	it("links both an Entity cover and title and opens each Tag card independently", async () => {
		renderWithTranslation(<UnitSubjectGroups associations={[subjectAssociation]} />);

		const entityLinks = screen.getAllByRole("link", { name: subjectAssociation.title });
		expect(entityLinks).toHaveLength(2);
		for (const link of entityLinks)
			expect(link.getAttribute("href")).toBe(`/entities/${subjectAssociation.entityEntryId}`);
		const entityBody = screen.getByRole("heading", {
			name: subjectAssociation.title,
		}).parentElement;
		expect(entityBody?.classList.contains("self-start")).toBe(true);
		expect(entityBody?.classList.contains("self-center")).toBe(false);
		expect(screen.getByText(subjectAssociation.summary)).toBeTruthy();

		fireEvent.click(screen.getByRole("link", { name: /Red/ }));
		const tagTitleLink = await screen.findByRole("link", { name: "Red" });
		expect(tagTitleLink.getAttribute("href")).toBe(`/tags/${subjectAssociationTagId}`);
	});

	it("keeps an empty linked Cover when an Entity has no cover source", () => {
		renderWithTranslation(
			<UnitSubjectGroups associations={[{ ...subjectAssociation, cover: null }]} />,
		);

		expect(screen.getByRole("img", { name: subjectAssociation.title })).toBeTruthy();
		expect(screen.getAllByRole("link", { name: subjectAssociation.title })).toHaveLength(2);
		expect(screen.queryByText("E")).toBeNull();
	});

	it("renders Variant navigation through FeedCard content without a Select action", () => {
		const variantId = "01941f29-7c00-7000-8000-000000000005";
		const variantTitle = "Realta Nua edition";
		const context = {
			role: "main",
			variants: [
				{
					id: variantId,
					type: "software",
					language: "en",
					title: variantTitle,
					cover: {
						id: "01941f29-7c00-7000-8000-000000000006",
						url: "https://example.test/realta-nua.webp",
					},
				},
			],
		} satisfies ComponentProps<typeof UnitVariantList>["context"];

		const { container } = renderWithTranslation(<UnitVariantList context={context} />);

		const href = `/units/software/${variantId}`;
		const variantLinks = container.querySelectorAll(`a[href="${href}"]`);
		expect(variantLinks).toHaveLength(2);
		expect(
			Array.from(variantLinks).some((link) => link.querySelector(`img[alt="${variantTitle}"]`)),
		).toBe(true);
		expect(
			screen.getByRole("heading", { name: variantTitle }).closest("a")?.getAttribute("href"),
		).toBe(href);
		expect(screen.queryByRole("link", { name: "Select" })).toBeNull();
		expect(screen.getByRole("button", { name: "More actions" })).toBeTruthy();
	});
});
