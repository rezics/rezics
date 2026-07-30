/** @vitest-environment jsdom */

import type {
	GetApiUnitsMediaByUnitIdContentStructureNodesStatus200,
	PutApiUnitsMediaByUnitIdContentStructureOptions,
	PutApiUnitsMediaByUnitIdContentStructureStatus200,
} from "@rezics/openapi-tanstack-query";
import { resources } from "@rezics/i18n/resources";
import { UiProvider } from "@rezics/ui";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import type { ComponentProps, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { MediaContentStructureEditor } from "./media-content-structure-editor";

const ids = {
	media: "019f0000-0000-7000-8000-000000000001",
	structure: "019f0000-0000-7000-8000-000000000002",
	revision: "019f0000-0000-7000-8000-000000000003",
	node: "019f0000-0000-7000-8000-000000000004",
	createdUnit: "019f0000-0000-7000-8000-000000000005",
} as const;

const state = vi.hoisted(() => ({
	invalidate: vi.fn(() => Promise.resolve()),
	mutateAsync: vi.fn(),
	reset: vi.fn(),
	push: vi.fn(),
}));

function savedResponse(
	options: PutApiUnitsMediaByUnitIdContentStructureOptions,
): PutApiUnitsMediaByUnitIdContentStructureStatus200 {
	const node = options.body.nodes.at(-1);
	if (!node || node.state !== "new") throw new Error("Expected a newly inserted node");
	return {
		state: "initialized",
		structureId: ids.structure,
		latestRevisionId: ids.revision,
		revisionCreated: true,
		items: [
			{
				id: node.id,
				parentId: node.parentId,
				contentUnitId: ids.createdUnit,
				contentKind: node.contentKind,
				language: node.language,
				title: node.title,
				position: "a0",
				durationSeconds: null,
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
		usePutApiUnitsMediaByUnitIdContentStructure: () => ({
			error: null,
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
	invalidateMediaContentStructure: state.invalidate,
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

const initial = {
	state: "uninitialized",
	items: [],
} satisfies GetApiUnitsMediaByUnitIdContentStructureNodesStatus200;

function renderEditor() {
	return render(
		<TranslationProvider initial={translation.snapshot}>
			<UiProvider searchEntities={() => Promise.resolve([])}>
				<MediaContentStructureEditor initial={initial} mediaId={ids.media} />
			</UiProvider>
		</TranslationProvider>,
	);
}

beforeEach(() => {
	state.invalidate.mockClear();
	state.mutateAsync.mockReset();
	state.mutateAsync.mockImplementation(
		async (
			options: PutApiUnitsMediaByUnitIdContentStructureOptions,
		): Promise<PutApiUnitsMediaByUnitIdContentStructureStatus200> => savedResponse(options),
	);
	state.reset.mockClear();
	state.push.mockClear();
	vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue(ids.node);
});

afterEach(() => {
	vi.restoreAllMocks();
	cleanup();
});

describe("MediaContentStructureEditor lazy initialization", () => {
	it("creates the structure on the first changed draft save", async () => {
		renderEditor();

		expect(screen.queryByRole("link", { name: "修訂歷史" })).toBeNull();
		fireEvent.click(screen.getByRole("button", { name: "新建標目" }));
		fireEvent.change(screen.getByRole("textbox", { name: "標題" }), {
			target: { value: "第一幕" },
		});
		const submitButton = screen.getByRole("button", { name: "建立標目並儲存" });
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
		expect(state.mutateAsync).toHaveBeenCalledWith({
			path: { unitId: ids.media },
			body: {
				base: { kind: "uninitialized" },
				nodes: [
					{
						state: "new",
						id: ids.node,
						parentId: null,
						order: 0,
						title: "第一幕",
						language: "zh",
						contentKind: "label",
					},
				],
			},
		});
		await vi.waitFor(() => expect(screen.getByRole("link", { name: "修訂歷史" })).toBeTruthy());
		expect(state.invalidate).toHaveBeenCalledWith(expect.anything(), ids.media);
	});
});
