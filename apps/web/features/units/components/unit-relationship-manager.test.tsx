/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { UiProvider } from "@rezics/ui";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { create } from "native-i18n";
import { afterEach, describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { AddCreditDialog } from "./unit-relationship-manager";

const api = vi.hoisted(() => ({
	mutateAsync: vi.fn(),
	reset: vi.fn(),
}));

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
		usePostApiUnitsByTypeByUnitIdCreditAttributions: () => ({
			error: null,
			isPending: false,
			mutateAsync: api.mutateAsync,
			reset: api.reset,
		}),
	};
});

vi.mock("@rezics/ui", async () => {
	const actual = await vi.importActual<typeof import("@rezics/ui")>("@rezics/ui");
	return {
		...actual,
		EntityPicker: ({
			ariaLabel,
			onChange,
			onClear,
			value,
		}: {
			readonly ariaLabel: string;
			readonly onChange: (value: { readonly id: string; readonly label: string }) => void;
			readonly onClear?: () => void;
			readonly value?: { readonly id: string; readonly label: string };
		}) => (
			<div>
				<button
					aria-label={ariaLabel}
					onClick={() => onChange({ id: "entity-1", label: "Example Studio" })}
					type="button"
				>
					{value?.label ?? ariaLabel}
				</button>
				{value ? (
					<button aria-label="clear-test-entity" onClick={onClear} type="button" />
				) : null}
			</div>
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
		takeRecords() {
			return [];
		}
	},
);

const translation = await create(resources).getTranslation(["errors", "ui", "units"], ["zh-Hant"]);

async function renderDialog(onRestricted = vi.fn()) {
	const client = new QueryClient({
		defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
	});
	const onOpenChange = vi.fn();
	await act(async () => {
		render(
			<TranslationProvider initial={translation.snapshot}>
				<QueryClientProvider client={client}>
					<UiProvider>
						<AddCreditDialog
							onOpenChange={onOpenChange}
							onRestricted={onRestricted}
							open
							type="software"
							unitId="019fa2b0-1000-7000-8000-000000000001"
						/>
					</UiProvider>
				</QueryClientProvider>
			</TranslationProvider>,
		);
	});
	return { onOpenChange, onRestricted };
}

afterEach(() => {
	cleanup();
	api.mutateAsync.mockReset();
	api.reset.mockReset();
	vi.restoreAllMocks();
});

describe("AddCreditDialog", () => {
	it("clears the selected Entity proof before submission", async () => {
		await renderDialog();
		const submit = await screen.findByRole("button", { name: "新增署名" });

		expect(submit).toHaveProperty("disabled", true);
		fireEvent.click(screen.getByRole("button", { name: "署名個人或組織" }));
		expect(submit).toHaveProperty("disabled", false);
		fireEvent.click(screen.getByRole("button", { name: "clear-test-entity" }));

		expect(submit).toHaveProperty("disabled", true);
		fireEvent.click(submit);
		expect(api.mutateAsync).not.toHaveBeenCalled();
	});

	it("turns a restricted direct association into an explicit consent request", async () => {
		api.mutateAsync.mockRejectedValue({
			data: { error: { code: "EntityAssociationRestricted" } },
		});
		const { onRestricted } = await renderDialog();
		fireEvent.click(await screen.findByRole("button", { name: "署名個人或組織" }));
		fireEvent.click(screen.getByRole("button", { name: "新增署名" }));

		await waitFor(() =>
			expect(onRestricted).toHaveBeenCalledWith({
				kind: "credit",
				role: "developer",
				targetUnitId: "entity-1",
			}),
		);
		expect(api.reset).toHaveBeenCalledOnce();
	});
});
