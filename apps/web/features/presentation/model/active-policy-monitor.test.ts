/** @vitest-environment jsdom */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
	activePresentationPolicyNavigation,
	startActivePresentationPolicyMonitor,
	type ActivePresentationPolicyMonitor,
} from "./active-policy-monitor";

const HostUnitId = "019f9000-0000-7000-8000-000000000001";
const RevisionId = "019f9000-0000-7000-8000-000000000002";
let monitor: ActivePresentationPolicyMonitor | undefined;

afterEach(() => {
	monitor?.dispose();
	monitor = undefined;
	vi.useRealTimers();
});

describe("active Custom Theme policy monitor", () => {
	it("keeps the current active revision without navigating", async () => {
		const onInvalidated = vi.fn();
		const fetcher = vi.fn(async (_input: RequestInfo | URL) =>
			Response.json({ revisionId: RevisionId }),
		);
		monitor = startActivePresentationPolicyMonitor({
			hostUnitId: HostUnitId,
			revisionId: RevisionId,
			onInvalidated,
			fetcher,
		});
		await monitor.check();
		expect(onInvalidated).not.toHaveBeenCalled();
		expect(String(fetcher.mock.calls[0]?.[0])).toContain(`hostUnitId=${HostUnitId}`);
	});

	it("moves an active document to safe mode when a kill or global disable resolves fallback", async () => {
		const onInvalidated = vi.fn();
		const fetcher = vi.fn(async () => Response.json({ revisionId: null }));
		monitor = startActivePresentationPolicyMonitor({
			hostUnitId: HostUnitId,
			revisionId: RevisionId,
			onInvalidated,
			fetcher,
		});
		await monitor.check();
		expect(onInvalidated).toHaveBeenCalledWith(null);
		expect(activePresentationPolicyNavigation(RevisionId, null)).toBe("safe_mode");
		await monitor.check();
		expect(fetcher).toHaveBeenCalledOnce();
	});

	it("uses a clean reload when the exact installed revision changes", async () => {
		const nextRevisionId = "019f9000-0000-7000-8000-000000000004";
		expect(activePresentationPolicyNavigation(RevisionId, nextRevisionId)).toBe("reload");
	});

	it("fails closed on an unavailable or malformed probe", async () => {
		const onInvalidated = vi.fn();
		monitor = startActivePresentationPolicyMonitor({
			hostUnitId: HostUnitId,
			revisionId: RevisionId,
			onInvalidated,
			fetcher: vi.fn(async () => new Response(null, { status: 503 })),
		});
		await monitor.check();
		expect(onInvalidated).toHaveBeenCalledWith(null);
	});
});
