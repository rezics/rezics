/** @vitest-environment jsdom */

import type { PortableTextValue } from "@rezics/portable-text";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const { developmentPreviewState, invalidatePostQueries, mutateAsync, push } = vi.hoisted(() => ({
	developmentPreviewState: {
		current: "denied" as "pending" | "denied" | "allowed" | "error",
	},
	invalidatePostQueries: vi.fn(async (_queryClient: unknown, _postId: string) => undefined),
	mutateAsync: vi.fn(async (_variables: unknown) => ({ id: "post-1" })),
	push: vi.fn((_href: string) => undefined),
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	usePostApiPosts: () => ({
		error: null,
		isPending: false,
		mutateAsync,
	}),
}));

vi.mock("@rezics/ui", () => ({
	Button: ({
		children,
		disabled,
		onClick,
		type,
	}: {
		readonly children: ReactNode;
		readonly disabled?: boolean;
		readonly onClick?: () => void;
		readonly type?: "button" | "submit";
	}) => (
		<button disabled={disabled} onClick={onClick} type={type}>
			{children}
		</button>
	),
	EntityPicker: ({
		onChange,
	}: {
		readonly onChange: (value: { readonly id: string; readonly label: string }) => void;
	}) => (
		<button
			aria-label="Choose discussion subject"
			onClick={() => onChange({ id: "subject-1", label: "Subject" })}
			type="button"
		/>
	),
	Field: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FieldDescription: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FieldGroup: ({ children }: { readonly children: ReactNode }) => <div>{children}</div>,
	FieldLabel: ({ children }: { readonly children: ReactNode }) => <label>{children}</label>,
	Input: (props: ComponentProps<"input">) => <input {...props} />,
	PageHeading: ({ title }: { readonly title: string }) => <h1>{title}</h1>,
	Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
	UnitMultiPicker: () => null,
}));

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({}),
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push }),
}));

vi.mock("@/features/auth/require-session", () => ({
	RequireSession: ({ children }: { readonly children: ReactNode }) => children,
}));

vi.mock("@/features/content-languages/components/draft-content-language-field", () => ({
	DraftContentLanguageField: () => null,
}));

vi.mock("@/features/content-languages/hooks/use-form-draft-content-language", () => ({
	useFormDraftContentLanguage: () => ({
		controller: {},
		onInput: vi.fn(),
		resolveLanguage: async () => "en",
	}),
}));

vi.mock("@/features/content-languages/model/draft-content-language-sample", () => ({
	portableTextDraftContentLanguageSample: () => undefined,
}));

vi.mock("@/features/preview-access/components/development-preview-boundary", () => ({
	useDevelopmentPreviewAccess: () => ({
		state: developmentPreviewState.current,
	}),
}));

vi.mock("@/features/realms/components/realm-rules-acknowledgement-prompt", () => ({
	RealmRulesAcknowledgementPrompt: () => null,
}));

vi.mock("@/features/realms/hooks/use-realm-rules-acknowledgement", () => ({
	useRealmRulesAcknowledgement: () => ({
		run: async <Result,>(operation: () => Promise<Result>) => operation(),
	}),
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({
		t: {
			posts: {
				clearSubject: "Clear subject",
				createTitle: "Create post",
				publish: "Publish",
				publishRealms: "Publish Realms",
				publishRealmsHint: "Realm hint",
				publishRealmsLimit: "Realm limit",
				removePublishRealm: "Remove Realm",
				subject: "Discussion subject",
				summaryOptional: "Summary (optional)",
				titleOptional: "Title (optional)",
			},
		},
	}),
}));

vi.mock("@/lib/block", () => ({
	writePortableText: (value: PortableTextValue) => value,
}));

vi.mock("../components/post-editor-fields", () => ({
	PostEditorFields: ({
		body,
		onBodyChange,
		submitLabel,
	}: {
		readonly body: PortableTextValue;
		readonly onBodyChange: (value: PortableTextValue) => void;
		readonly submitLabel: string;
	}) => (
		<>
			<button
				onClick={() =>
					onBodyChange([
						{
							_key: "body-block",
							_type: "block",
							children: [],
							markDefs: [],
							style: "normal",
						},
					])
				}
				type="button"
			>
				Enter body
			</button>
			<button disabled={!body.length} type="submit">
				{submitLabel}
			</button>
		</>
	),
}));

vi.mock("../query", () => ({
	invalidatePostQueries,
}));

vi.mock("../url", () => ({
	postHref: (postId: string) => `/posts/${postId}`,
}));

import { PostCreatePage } from "./post-create-page";

afterEach(() => {
	cleanup();
	developmentPreviewState.current = "denied";
	invalidatePostQueries.mockClear();
	mutateAsync.mockClear();
	push.mockClear();
});

describe("PostCreatePage", () => {
	it.each(["pending", "denied", "error"] as const)(
		"omits direct subject search when development preview access is %s",
		(state) => {
			developmentPreviewState.current = state;

			render(<PostCreatePage />);

			expect(screen.queryByText("Discussion subject")).toBeNull();
			expect(screen.queryByRole("button", { name: "Choose discussion subject" })).toBeNull();
		},
	);

	it("shows direct subject search with development preview access", () => {
		developmentPreviewState.current = "allowed";

		render(<PostCreatePage />);

		expect(screen.getByText("Discussion subject")).toBeTruthy();
		expect(screen.getByRole("button", { name: "Choose discussion subject" })).toBeTruthy();
	});

	it("submits a selected subject with development preview access", async () => {
		developmentPreviewState.current = "allowed";
		render(<PostCreatePage />);
		fireEvent.click(screen.getByRole("button", { name: "Choose discussion subject" }));
		fireEvent.click(screen.getByRole("button", { name: "Enter body" }));
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
		expect(mutateAsync).toHaveBeenCalledWith({
			body: expect.objectContaining({ subjectId: "subject-1" }),
		});
	});

	it("does not submit a selected subject after development preview access is lost", async () => {
		developmentPreviewState.current = "allowed";
		const { rerender } = render(<PostCreatePage />);
		fireEvent.click(screen.getByRole("button", { name: "Choose discussion subject" }));

		developmentPreviewState.current = "denied";
		rerender(<PostCreatePage />);
		fireEvent.click(screen.getByRole("button", { name: "Enter body" }));
		fireEvent.click(screen.getByRole("button", { name: "Publish" }));

		await waitFor(() => expect(mutateAsync).toHaveBeenCalledOnce());
		const variables = mutateAsync.mock.calls[0]?.[0] as {
			readonly body: Record<string, unknown>;
		};
		expect(variables.body).not.toHaveProperty("subjectId");
	});
});
