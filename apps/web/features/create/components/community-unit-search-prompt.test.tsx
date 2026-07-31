// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@rezics/ui", () => {
	const Block = ({ children }: { readonly children?: ReactNode }) => <div>{children}</div>;
	return {
		Checkbox: ({
			"aria-labelledby": ariaLabelledBy,
			checked,
			ids,
			name,
			onCheckedChange,
			required,
		}: {
			readonly "aria-labelledby": string;
			readonly checked: boolean;
			readonly ids: { readonly hiddenInput: string };
			readonly name: string;
			readonly onCheckedChange: (details: { readonly checked: boolean }) => void;
			readonly required: boolean;
		}) => (
			<input
				aria-labelledby={ariaLabelledBy}
				checked={checked}
				id={ids.hiddenInput}
				name={name}
				onChange={(event) => onCheckedChange({ checked: event.currentTarget.checked })}
				required={required}
				type="checkbox"
			/>
		),
		Field: Block,
		FieldLabel: ({ children, ...props }: ComponentProps<"label">) => (
			<label {...props}>{children}</label>
		),
		HoverCard: Block,
		HoverCardContent: Block,
		HoverCardTrigger: Block,
	};
});

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			communityUnitSearch: {
				confirmationLabel: ({ subject }: { readonly subject: string }) =>
					`I checked the existing ${subject}.`,
				policy: "Search before creating a public entry.",
				prompt: ({ subject }: { readonly subject: string }) => `Search existing ${subject}`,
				subjects: {
					book: "books",
					character: "characters",
					media: "media entries",
					organization: "organizations",
					person: "people",
					software: "software entries",
					tag: "tags",
				},
			},
		},
	}),
}));

import { entityCommunityUnitSearchSubject } from "@/features/create/model/community-unit-search";
import { CommunityUnitSearchPrompt } from "./community-unit-search-prompt";

describe("CommunityUnitSearchPrompt", () => {
	it("requires a confirmation checkbox and keeps the exact Entity search link", () => {
		const onConfirmedChange = vi.fn();
		const { container } = render(
			<CommunityUnitSearchPrompt
				confirmed={false}
				onConfirmedChange={onConfirmedChange}
				query="OpenAI"
				subject={entityCommunityUnitSearchSubject("organization")}
			/>,
		);

		const checkbox = screen.getByRole("checkbox", {
			name: "I checked the existing organizations.",
		});
		expect(checkbox.hasAttribute("required")).toBe(true);
		checkbox.click();
		expect(onConfirmedChange).toHaveBeenCalledWith(true);
		expect(screen.getByText("I checked the existing organizations.")).toBeTruthy();
		const searchLink = screen.getByRole("link", {
			name: "Search existing organizations",
		});
		expect(searchLink.getAttribute("href")).toBe(
			"/create/entity/search?kind=organization&q=OpenAI",
		);
		expect(searchLink.getAttribute("rel")).toBe("noopener noreferrer");
		expect(searchLink.getAttribute("target")).toBe("_blank");
		expect(searchLink.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
		expect(container.firstElementChild?.classList.contains("gap-2")).toBe(true);
		expect(searchLink.classList.contains("font-semibold")).toBe(true);
		expect(searchLink.classList.contains("no-underline")).toBe(true);
		expect(searchLink.classList.contains("hover:underline")).toBe(true);
		expect(screen.getByText("Search before creating a public entry.")).toBeTruthy();
	});
});
