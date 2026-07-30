// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
	publicEntrySearchConfirmation,
	TagPublicEntrySearchSubject,
} from "@/features/catalog/model/public-entry-search";

const state = vi.hoisted(() => ({
	applyGlobal: vi.fn(),
	applyRealm: vi.fn(),
	create: vi.fn(),
	invalidateQueries: vi.fn(),
	push: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: { Tags: "tags" },
	getApiRealmsByRealmIdUnitsByUnitIdTagsQueryKey: (input: unknown) => ["realm-tags", input],
	getApiTagsQueryKey: () => ["tags"],
	getApiUnitsByTypeByUnitIdTagsQueryKey: (input: unknown) => ["unit-tags", input],
	usePostApiTags: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.create,
	}),
	usePutApiRealmsByRealmIdUnitsByUnitIdTagsByTagIdVote: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.applyRealm,
	}),
	usePutApiUnitsByTypeByUnitIdTagsByTagId: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.applyGlobal,
	}),
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({ invalidateQueries: state.invalidateQueries }),
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push: state.push }),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: ({ children, href, ...props }: ComponentProps<"a">) => (
		<a href={href} {...props}>
			{children}
		</a>
	),
}));

vi.mock("@/features/catalog/components/public-entry-search-prompt", () => ({
	PublicEntrySearchPrompt: ({ confirmed }: { readonly confirmed: boolean }) => (
		<div data-testid="search-confirmation">{String(confirmed)}</div>
	),
}));

vi.mock("@/features/content-languages/components/draft-content-language-field", () => ({
	DraftContentLanguageField: () => null,
}));

vi.mock("@/features/content-languages/hooks/use-form-draft-content-language", () => ({
	useFormDraftContentLanguage: () => ({
		controller: {},
		onInput: vi.fn(),
		resolveLanguage: vi.fn(async () => "en"),
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			tags: {
				create: {
					applying: "Recording vote",
					backToStudioTags: "Back to Studio Tags",
					backToUnitTags: "Back to Unit Tags",
					completed: "Completed",
					description: "Create a Tag.",
					partialDescription: "Retry without creating another Tag.",
					partialTitle: "Tag created, vote not recorded",
					retryVote: "Retry vote",
					returnToUnitTags: "Return to Unit Tags",
					submit: "Create Tag",
					submitAndVote: 'Create Tag and vote "Fits"',
					title: "Create a Tag",
					voteDescription: "Create and vote.",
				},
			},
			ui: {
				retryLater: "Try again later",
				summary: "Summary",
				title: "Title",
			},
		},
	}),
}));

vi.mock("@/i18n/request-failure", () => ({
	RequestFailure: () => null,
}));

vi.mock("@rezics/ui", () => ({
	Alert: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	AlertAction: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	AlertDescription: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	AlertTitle: ({ children }: { readonly children: ReactNode }) => <h2>{children}</h2>,
	Button: ({
		asChild,
		children,
		disabled,
		onClick,
		type,
	}: {
		readonly asChild?: boolean;
		readonly children: ReactNode;
		readonly disabled?: boolean;
		readonly onClick?: () => void;
		readonly type?: "button" | "submit" | "reset";
	}) =>
		asChild ? (
			children
		) : (
			<button disabled={disabled} onClick={onClick} type={type ?? "button"}>
				{children}
			</button>
		),
	Field: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FieldGroup: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FieldLabel: ({ children }: { readonly children: ReactNode }) => <span>{children}</span>,
	Input: (props: ComponentProps<"input">) => <input {...props} />,
	ManagementWorkspaceSectionHeader: ({
		backHref,
		backLabel,
		description,
		link,
		title,
	}: {
		readonly backHref: string;
		readonly backLabel: string;
		readonly description: string;
		readonly link: (props: ComponentProps<"a">) => ReactNode;
		readonly title: string;
	}) => {
		const Link = link;
		return (
			<header>
				<Link href={backHref}>{backLabel}</Link>
				<h1>{title}</h1>
				<p>{description}</p>
			</header>
		);
	},
	Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
}));

import { TagCreatePage } from "./tag-create-page";

const UnitId = "00000000-0000-7000-8000-000000000001";
const RealmId = "00000000-0000-7000-8000-000000000002";
const TagId = "00000000-0000-7000-8000-000000000003";
const Title = "Science";
const Confirmation = publicEntrySearchConfirmation(TagPublicEntrySearchSubject, Title);

beforeEach(() => {
	cleanup();
	state.applyGlobal.mockReset();
	state.applyRealm.mockReset();
	state.create.mockReset();
	state.invalidateQueries.mockReset();
	state.push.mockReset();
	state.create.mockResolvedValue({ id: TagId });
	state.applyGlobal.mockResolvedValue({});
	state.applyRealm.mockResolvedValue({});
	state.invalidateQueries.mockResolvedValue(undefined);
});

describe("TagCreatePage", () => {
	it("creates, applies, and returns to the original global Unit Tag context", async () => {
		render(
			<TagCreatePage
				initialTitle={Title}
				intent={{
					kind: "unit-tag-vote",
					type: "book",
					unitId: UnitId,
					context: { kind: "global" },
				}}
				publicEntrySearchConfirmation={Confirmation}
			/>,
		);

		expect(screen.getByTestId("search-confirmation").textContent).toBe("true");
		fireEvent.click(screen.getByRole("button", { name: 'Create Tag and vote "Fits"' }));

		await waitFor(() =>
			expect(state.create).toHaveBeenCalledWith({
				body: {
					localization: {
						language: "en",
						title: Title,
					},
				},
			}),
		);
		expect(state.applyGlobal).toHaveBeenCalledWith({
			path: { type: "book", unitId: UnitId, tagId: TagId },
			body: {},
		});
		expect(state.applyRealm).not.toHaveBeenCalled();
		await waitFor(() => expect(state.push).toHaveBeenCalledOnce());
		const destination = new URL(state.push.mock.calls[0]?.[0], "https://rezics.example");
		expect(destination.pathname).toBe(`/units/book/${UnitId}/tags`);
		expect(destination.searchParams.get("context")).toBe("global");
		expect(destination.searchParams.get("createdTagId")).toBe(TagId);
	});

	it("records a Realm vote with the preserved Realm identity", async () => {
		render(
			<TagCreatePage
				initialTitle={Title}
				intent={{
					kind: "unit-tag-vote",
					type: "media",
					unitId: UnitId,
					context: { kind: "realm", realmId: RealmId },
				}}
				publicEntrySearchConfirmation={Confirmation}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: 'Create Tag and vote "Fits"' }));

		await waitFor(() =>
			expect(state.applyRealm).toHaveBeenCalledWith({
				path: { realmId: RealmId, unitId: UnitId, tagId: TagId },
				body: { value: 1 },
			}),
		);
		expect(state.applyGlobal).not.toHaveBeenCalled();
		const destination = new URL(state.push.mock.calls[0]?.[0], "https://rezics.example");
		expect(destination.searchParams.get("context")).toBe("realm");
		expect(destination.searchParams.get("realmId")).toBe(RealmId);
	});

	it("retries only the vote after creation succeeds but application fails", async () => {
		state.applyGlobal.mockRejectedValueOnce(new Error("vote failed"));
		render(
			<TagCreatePage
				initialTitle={Title}
				intent={{
					kind: "unit-tag-vote",
					type: "software",
					unitId: UnitId,
					context: { kind: "global" },
				}}
				publicEntrySearchConfirmation={Confirmation}
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: 'Create Tag and vote "Fits"' }));
		expect(
			await screen.findByRole("heading", {
				name: "Tag created, vote not recorded",
			}),
		).toBeTruthy();
		expect(state.create).toHaveBeenCalledOnce();
		expect(state.push).not.toHaveBeenCalled();

		fireEvent.click(screen.getByRole("button", { name: "Retry vote" }));

		await waitFor(() => expect(state.applyGlobal).toHaveBeenCalledTimes(2));
		expect(state.create).toHaveBeenCalledOnce();
		await waitFor(() => expect(state.push).toHaveBeenCalledOnce());
	});
});
