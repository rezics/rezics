/** @vitest-environment jsdom */

import type {
	GetApiUnitsBookByUnitIdContentStructureNodesStatus200,
	PutApiUnitsBookByUnitIdContentStructureOptions,
	PutApiUnitsBookByUnitIdContentStructureStatus200,
} from "@rezics/openapi-tanstack-query";
import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { StrictMode, type ComponentProps, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { BookContentStructureEditor } from "./book-content-structure-editor";

type SaveNode = PutApiUnitsBookByUnitIdContentStructureOptions["body"]["nodes"][number];

const ids = {
	book: "019f0000-0000-7000-8000-000000000001",
	structure: "019f0000-0000-7000-8000-000000000002",
	revision: "019f0000-0000-7000-8000-000000000003",
	node: "019f0000-0000-7000-8000-000000000004",
	createdUnit: "019f0000-0000-7000-8000-000000000005",
	attachedUnit: "019f0000-0000-7000-8000-000000000006",
	existingNode: "019f0000-0000-7000-8000-000000000007",
	existingUnit: "019f0000-0000-7000-8000-000000000008",
} as const;

const state = vi.hoisted(() => ({
	error: null as unknown,
	reject: false,
	invalidate: vi.fn(() => Promise.resolve()),
	mutateAsync: vi.fn(),
	reset: vi.fn(),
	push: vi.fn(),
}));

function savedResponse(
	options: PutApiUnitsBookByUnitIdContentStructureOptions,
): PutApiUnitsBookByUnitIdContentStructureStatus200 {
	const node = options.body.nodes.at(-1);
	if (!node || node.state === "existing") throw new Error("Expected a newly inserted node");
	return {
		ownershipMode: "community_owned",
		structureId: ids.structure,
		latestRevisionId: ids.revision,
		revisionCreated: true,
		items: [
			{
				id: node.id,
				parentId: node.parentId,
				contentUnitId: node.state === "attached" ? node.contentUnitId : ids.createdUnit,
				contentKind: node.state === "new" ? node.contentKind : ("chapter" as const),
				language: node.state === "new" ? node.language : "zh",
				title: node.state === "new" ? node.title : "既有章節",
				position: "a0",
				contentMetrics: { wordCount: 0, characterCount: 0 },
			},
		],
	};
}

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", async () => {
	const actual = await vi.importActual<typeof import("@rezics/openapi-tanstack-query")>(
		"@rezics/openapi-tanstack-query",
	);
	return {
		...actual,
		usePutApiUnitsBookByUnitIdContentStructure: () => ({
			error: state.error,
			isPending: false,
			mutateAsync: state.mutateAsync,
			reset: state.reset,
		}),
	};
});

vi.mock("@tanstack/react-query", () => ({
	useQueryClient: () => ({}),
}));

vi.mock("../unit-cache", () => ({
	invalidateBookContentStructure: state.invalidate,
}));

vi.mock("@/features/application-shell/hooks/use-application-router", () => ({
	useApplicationRouter: () => ({ push: state.push }),
}));

vi.mock("@/features/application-shell/components/app-link", () => ({
	AppLink: (props: ComponentProps<"a">) => <a {...props} />,
}));

vi.mock("./unit-section-header", () => ({
	UnitSectionHeader: ({
		action,
		description,
		title,
	}: {
		readonly action?: ReactNode;
		readonly description?: string;
		readonly title: string;
	}) => (
		<header>
			<h1>{title}</h1>
			{description ? <p>{description}</p> : null}
			{action}
		</header>
	),
}));

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		EntityPicker: ({
			onChange,
		}: {
			readonly onChange: (value: { id: string; label: string; kind: string }) => void;
		}) => (
			<button
				onClick={() =>
					onChange({
						id: ids.attachedUnit,
						label: "既有章節",
						kind: "chapter",
					})
				}
				type="button"
			>
				選擇既有章節
			</button>
		),
	};
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

vi.stubGlobal("CSS", {
	escape: (value: string) => value,
});

window.scrollTo = vi.fn();

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "engagement", "errorCodes", "errors", "state", "ui", "units"],
	["zh-Hant"],
);

const initial: GetApiUnitsBookByUnitIdContentStructureNodesStatus200 & {
	readonly structureId: string;
	readonly latestRevisionId: string;
} = {
	ownershipMode: "community_owned",
	structureId: ids.structure,
	latestRevisionId: ids.revision,
	items: [],
};

const initialWithChapter = {
	...initial,
	items: [
		{
			id: ids.existingNode,
			parentId: null,
			contentUnitId: ids.existingUnit,
			contentKind: "chapter",
			language: "zh",
			title: "既有第一章",
			position: "a0",
			contentMetrics: { wordCount: 10, characterCount: 20 },
		},
	],
} satisfies GetApiUnitsBookByUnitIdContentStructureNodesStatus200 & {
	readonly structureId: string;
	readonly latestRevisionId: string;
};

function renderEditor(value = initial) {
	return render(
		<StrictMode>
			<TranslationProvider initial={translation.snapshot}>
				<UiProvider searchEntities={() => Promise.resolve([])}>
					<BookContentStructureEditor bookId={ids.book} initial={value} />
				</UiProvider>
			</TranslationProvider>
		</StrictMode>,
	);
}

beforeEach(() => {
	state.error = null;
	state.reject = false;
	state.invalidate.mockClear();
	state.mutateAsync.mockReset();
	state.mutateAsync.mockImplementation(
		async (
			options: PutApiUnitsBookByUnitIdContentStructureOptions,
		): Promise<PutApiUnitsBookByUnitIdContentStructureStatus200> => {
			if (state.reject) throw new Error("save failed");
			return savedResponse(options);
		},
	);
	state.reset.mockClear();
	state.push.mockClear();
	vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(ids.node);
});

afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

describe("BookContentStructureEditor node dialog", () => {
	it("creates a Unit and saves the complete structure from the default mode", async () => {
		renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "新建章節" }));
		expect(screen.getByRole("tab", { name: "建立" }).getAttribute("aria-selected")).toBe(
			"true",
		);
		fireEvent.change(screen.getByRole("textbox", { name: "標題" }), {
			target: { value: "第一章" },
		});
		const submitButton = screen.getByRole("button", { name: "建立章節並儲存" });
		const formId = submitButton.getAttribute("form");
		expect(formId).not.toBeNull();
		if (!formId) throw new Error("Expected an explicitly associated form");
		expect(
			submitButton.closest("[data-slot='dialog-footer']")?.parentElement?.dataset.slot,
		).toBe("dialog-content");
		expect(submitButton).toBeInstanceOf(HTMLButtonElement);
		if (!(submitButton instanceof HTMLButtonElement))
			throw new Error("Expected a submit button");
		expect(submitButton.form).toBe(document.getElementById(formId));
		fireEvent.click(submitButton);

		await vi.waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce());
		const options = state.mutateAsync.mock.calls[0]?.[0] as
			PutApiUnitsBookByUnitIdContentStructureOptions | undefined;
		expect(options).toEqual({
			path: { unitId: ids.book },
			body: {
				baseRevisionId: ids.revision,
				nodes: [
					expect.objectContaining({
						state: "new",
						id: ids.node,
						parentId: null,
						order: 0,
						title: "第一章",
						contentKind: "chapter",
						status: "draft",
					}),
				],
			},
		});
		await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
		expect(state.invalidate).toHaveBeenCalledWith(expect.anything(), ids.book);
	});

	it("sends an explicit Chapter ownership override", async () => {
		renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "新建章節" }));
		fireEvent.change(screen.getByRole("combobox", { name: "章節擁有方式" }), {
			target: { value: "profile_owned" },
		});
		fireEvent.change(screen.getByRole("textbox", { name: "標題" }), {
			target: { value: "個人章節" },
		});
		fireEvent.click(screen.getByRole("button", { name: "建立章節並儲存" }));

		await vi.waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce());
		const options = state.mutateAsync.mock.calls[0]?.[0] as
			PutApiUnitsBookByUnitIdContentStructureOptions | undefined;
		expect(options?.body.nodes.at(-1)).toEqual(
			expect.objectContaining({ ownershipMode: "profile_owned" }),
		);
	});

	it("attaches a searched Unit through the same complete draft mutation", async () => {
		renderEditor(initialWithChapter);

		fireEvent.click(screen.getByRole("button", { name: "新建章節" }));
		const attachTab = screen.getByRole("tab", { name: "加入" });
		fireEvent.click(attachTab);
		await vi.waitFor(() => expect(attachTab.getAttribute("aria-selected")).toBe("true"));
		fireEvent.click(await screen.findByRole("button", { name: "選擇既有章節" }));
		fireEvent.click(screen.getByRole("button", { name: "加入章節並儲存" }));

		await vi.waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce());
		const options = state.mutateAsync.mock.calls[0]?.[0] as
			PutApiUnitsBookByUnitIdContentStructureOptions | undefined;
		expect(options?.body.nodes[0]).toEqual({
			state: "existing",
			id: ids.existingNode,
			parentId: null,
			order: 0,
			title: "既有第一章",
		});
		const attached = options?.body.nodes.find((node: SaveNode) => node.state === "attached");
		expect(attached).toEqual({
			state: "attached",
			id: ids.node,
			parentId: null,
			order: 1,
			contentUnitId: ids.attachedUnit,
		});
		expect(attached).not.toHaveProperty("title");
		expect(attached).not.toHaveProperty("contentKind");
		await vi.waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
	});

	it("keeps the dialog input available when the atomic save fails", async () => {
		state.reject = true;
		renderEditor();

		fireEvent.click(screen.getByRole("button", { name: "新建章節" }));
		const title = screen.getByRole("textbox", { name: "標題" });
		fireEvent.change(title, { target: { value: "保留的標題" } });
		fireEvent.click(screen.getByRole("button", { name: "建立章節並儲存" }));

		await vi.waitFor(() => expect(state.mutateAsync).toHaveBeenCalledOnce());
		expect(screen.getByRole("dialog")).toBeTruthy();
		expect((screen.getByRole("textbox", { name: "標題" }) as HTMLInputElement).value).toBe(
			"保留的標題",
		);
	});
});
