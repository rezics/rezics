/** @vitest-environment jsdom */

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const generated = vi.hoisted(() => ({
	acknowledge: {
		error: null as unknown,
		isPending: false,
		mutateAsync: vi.fn(),
		reset: vi.fn(),
	},
	rules: {
		data: {
			revisionId: "019f995d-7595-7c99-9183-250790bbfe2f",
			items: [],
		},
		error: null as unknown,
		isFetching: false,
		refetch: vi.fn(),
	},
}));

vi.mock("@rezics/openapi-tanstack-query", () => ({
	useGetApiRealmsByRealmIdRules: () => generated.rules,
	usePutApiRealmsByRealmIdRulesByRevisionIdAcknowledgement: () => generated.acknowledge,
}));

vi.mock("@/i18n/client", () => ({
	useTranslation: () => ({ locale: { target: "zh-Hant" } }),
}));

vi.mock("@/i18n/use-localization-languages", () => ({
	useLocalizationLanguages: () => ["zh"],
}));

import { useRealmRulesAcknowledgement } from "./use-realm-rules-acknowledgement";

const apiError = (code: string) => ({ data: { error: { code } } });

beforeEach(() => {
	generated.acknowledge.mutateAsync.mockReset();
	generated.acknowledge.reset.mockReset();
	generated.rules.refetch.mockReset();
});

describe("useRealmRulesAcknowledgement", () => {
	it("acknowledges the current revision once and retries the protected operation", async () => {
		const operation = vi
			.fn<() => Promise<void>>()
			.mockRejectedValueOnce(apiError("RealmRulesAcceptanceRequired"))
			.mockResolvedValue(undefined);
		const { result } = renderHook(() =>
			useRealmRulesAcknowledgement("019f995d-7595-7c99-9183-250790bbfe30"),
		);

		await act(async () => result.current.run(operation));
		expect(result.current.open).toBe(true);

		await act(async () => result.current.confirm());

		expect(generated.acknowledge.mutateAsync).toHaveBeenCalledWith({
			path: {
				realmId: "019f995d-7595-7c99-9183-250790bbfe30",
				revisionId: "019f995d-7595-7c99-9183-250790bbfe2f",
			},
			body: { language: "zh" },
		});
		expect(operation).toHaveBeenCalledTimes(2);
		expect(result.current.open).toBe(false);
	});

	it("refetches instead of retrying when the displayed revision became stale", async () => {
		const operation = vi
			.fn<() => Promise<void>>()
			.mockRejectedValue(apiError("RealmRulesAcceptanceRequired"));
		generated.acknowledge.mutateAsync.mockRejectedValueOnce(
			apiError("RealmRuleRevisionChanged"),
		);
		const { result } = renderHook(() =>
			useRealmRulesAcknowledgement("019f995d-7595-7c99-9183-250790bbfe30"),
		);

		await act(async () => result.current.run(operation));
		await act(async () => result.current.confirm());

		expect(generated.rules.refetch).toHaveBeenCalledOnce();
		expect(operation).toHaveBeenCalledOnce();
		expect(result.current.open).toBe(true);
	});

	it("preserves unrelated failures for the owning mutation flow", async () => {
		const error = apiError("RealmCapabilityRequired");
		const operation = vi.fn<() => Promise<void>>().mockRejectedValue(error);
		const { result } = renderHook(() =>
			useRealmRulesAcknowledgement("019f995d-7595-7c99-9183-250790bbfe30"),
		);

		await expect(result.current.run(operation)).rejects.toBe(error);
		expect(result.current.open).toBe(false);
	});
});
