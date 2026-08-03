/** @vitest-environment jsdom */

import { resources } from "@rezics/i18n/resources";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { create } from "native-i18n";
import { describe, expect, it, vi } from "vitest";

import { TranslationProvider } from "@/i18n/client";
import { AccountApiQuotaEditor } from "./account-api-quota-editor";

const api = vi.hoisted(() => ({
	assign: vi.fn(async () => undefined),
	reset: vi.fn(async () => undefined),
}));

vi.mock("@/i18n/client", async () => {
	const { create: createReactI18n } = await import("native-i18n/react/client");
	return createReactI18n(resources);
});

vi.mock("@rezics/openapi-tanstack-query", () => ({
	getApiApiQuotaPoliciesAccountsByUserIdQueryKey: () => ["account-quota"],
	useGetApiApiQuotaPoliciesAccountsByUserId: () => ({
		data: {
			key: "standard-default",
			class: "standard",
			source: "standard_default",
			schemaVersion: 1,
			policyRevision: 1,
			bindingRevision: null,
			validUntil: null,
			assignmentReason: null,
			configurationOverride: {
				limits: { requestRate: { requestsPerMinute: 60, burstCapacity: 10 } },
			},
			limits: {
				requestRate: { requestsPerMinute: 60, burstCapacity: 10 },
				maxConcurrentRequests: 2,
				dailyCostUnits: 2_000,
			},
			maxActiveTokens: 10,
			operations: {},
		},
		isPending: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
	}),
	useGetApiApiQuotaPolicies: () => ({
		data: {
			items: [
				{
					id: "01983000-0000-7000-8000-000000000001",
					key: "standard-default",
					subjectKind: "account",
					class: "standard",
					schemaVersion: 1,
					configuration: {
						limits: {
							requestRate: { requestsPerMinute: 60, burstCapacity: 10 },
							maxConcurrentRequests: 2,
							dailyCostUnits: 2_000,
						},
						maxActiveTokens: 10,
						operations: {},
					},
					revision: 1,
					enabled: true,
					updatedAt: "2026-08-03T00:00:00.000Z",
				},
			],
		},
		isPending: false,
		isError: false,
		error: null,
		refetch: vi.fn(),
	}),
	usePutApiApiQuotaPoliciesAccountsByUserId: () => ({
		mutateAsync: api.assign,
		isPending: false,
		error: null,
	}),
	useDeleteApiApiQuotaPoliciesAccountsByUserId: () => ({
		mutateAsync: api.reset,
		isPending: false,
		error: null,
	}),
}));

vi.mock("./console-workspace", () => ({
	useConsoleWorkspace: () => ({
		canReadAccountApiQuotas: true,
		canUpdateAccountApiQuotas: true,
	}),
}));

const translation = await create(resources).getTranslation(
	["betterAuthErrorCodes", "console", "errorCodes", "errors", "state"],
	["zh-Hant"],
);

describe("AccountApiQuotaEditor", () => {
	it("keeps Save actionable and accepts policy-managed values above the former ceiling", async () => {
		const queryClient = new QueryClient({
			defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
		});
		render(
			<QueryClientProvider client={queryClient}>
				<TranslationProvider initial={translation.snapshot}>
					<AccountApiQuotaEditor userId="01983000-0000-7000-8000-000000000010" />
				</TranslationProvider>
			</QueryClientProvider>,
		);

		const save = await screen.findByRole("button", { name: "儲存帳戶額度" });
		expect((save as HTMLButtonElement).disabled).toBe(false);

		const requestsPerMinute = screen.getAllByRole("spinbutton")[0]!;
		expect(requestsPerMinute.getAttribute("max")).toBe(String(Number.MAX_SAFE_INTEGER));
		fireEvent.change(requestsPerMinute, { target: { value: "25000" } });
		expect((requestsPerMinute as HTMLInputElement).value).toBe("25000");
	});
});
