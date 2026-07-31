// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	applyGlobal: vi.fn(),
	create: vi.fn(),
	invalidateQueries: vi.fn(),
	push: vi.fn(),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	PostApiSearchByIndexIndex: { Tags: "tags" },
	getApiTagsQueryKey: () => ["tags"],
	getApiUnitsByTypeByUnitIdTagsQueryKey: (input: unknown) => ["unit-tags", input],
	usePostApiTags: () => ({
		error: null,
		isPending: false,
		mutateAsync: state.create,
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

vi.mock("@/features/create/components/community-unit-search-prompt", () => ({
	CommunityUnitSearchPrompt: ({
		confirmed,
		onConfirmedChange,
	}: {
		readonly confirmed: boolean;
		readonly onConfirmedChange: (confirmed: boolean) => void;
	}) => (
		<button type="button" onClick={() => onConfirmedChange(!confirmed)}>
			{confirmed ? "Search confirmed" : "Confirm search"}
		</button>
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

vi.mock("@/features/content-languages/model/draft-content-language-sample", () => ({
	portableTextDraftContentLanguageSample: () => undefined,
}));

vi.mock("@/features/editor/portable-text-editor", () => ({
	PortableTextEditor: ({
		label,
		onChange,
	}: {
		readonly label: string;
		readonly onChange: (value: readonly unknown[]) => void;
	}) => (
		<button
			type="button"
			onClick={() =>
				onChange([
					{
						_key: "body-block",
						_type: "block",
						children: [{ _key: "body-span", _type: "span", marks: [], text: "Body" }],
						markDefs: [],
						style: "normal",
					},
				])
			}
		>
			{label}
		</button>
	),
}));

vi.mock("@/lib/block", () => ({
	writePortableText: (content: readonly unknown[]) => ({
		_key: "body-document",
		_type: "portable-text",
		content,
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
				body: "Body",
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
const TagId = "00000000-0000-7000-8000-000000000003";
const Title = "Science";

beforeEach(() => {
	cleanup();
	state.applyGlobal.mockReset();
	state.create.mockReset();
	state.invalidateQueries.mockReset();
	state.push.mockReset();
	state.create.mockResolvedValue({ id: TagId });
	state.applyGlobal.mockResolvedValue({});
	state.invalidateQueries.mockResolvedValue(undefined);
});

describe("TagCreatePage", () => {
	it("requires confirmation again after the title changes", () => {
		render(<TagCreatePage initialTitle={Title} intent={{ kind: "standalone" }} />);

		const submit = screen.getByRole("button", { name: "Create Tag" });
		expect(submit.hasAttribute("disabled")).toBe(true);

		fireEvent.click(screen.getByRole("button", { name: "Confirm search" }));
		expect(submit.hasAttribute("disabled")).toBe(false);

		fireEvent.change(screen.getByDisplayValue(Title), {
			target: { value: "Natural science" },
		});
		expect(submit.hasAttribute("disabled")).toBe(true);
		expect(screen.getByRole("button", { name: "Confirm search" })).toBeTruthy();
	});

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
			/>,
		);

		expect(
			screen
				.getByRole("button", { name: 'Create Tag and vote "Fits"' })
				.hasAttribute("disabled"),
		).toBe(true);
		fireEvent.click(screen.getByRole("button", { name: "Confirm search" }));
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
		await waitFor(() => expect(state.push).toHaveBeenCalledOnce());
		const destination = new URL(state.push.mock.calls[0]?.[0], "https://rezics.example");
		expect(destination.pathname).toBe(`/units/book/${UnitId}/tags`);
		expect(destination.searchParams.get("context")).toBe("global");
		expect(destination.searchParams.get("createdTagId")).toBe(TagId);
	});

	it("stores an optional full body separately from the Tag summary", async () => {
		render(<TagCreatePage initialTitle={Title} intent={{ kind: "standalone" }} />);

		fireEvent.click(screen.getByRole("button", { name: "Body" }));
		fireEvent.click(screen.getByRole("button", { name: "Confirm search" }));
		fireEvent.click(screen.getByRole("button", { name: "Create Tag" }));

		await waitFor(() => expect(state.create).toHaveBeenCalledOnce());
		expect(state.create.mock.calls[0]?.[0].body.localization).toMatchObject({
			language: "en",
			title: Title,
			description: {
				_key: "body-document",
				_type: "portable-text",
				content: [expect.objectContaining({ _type: "block" })],
			},
		});
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
			/>,
		);

		fireEvent.click(screen.getByRole("button", { name: "Confirm search" }));
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
