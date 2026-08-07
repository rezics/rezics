import { describe, expect, it, vi } from "vitest";

import type { DatabaseExecutor } from "../../database";
import { PlatformAuthorization, type PlatformCapability } from "./authorization";

function grantExecutor(rows: readonly { readonly capability: PlatformCapability }[]) {
	const where = vi.fn(async () => rows);
	const from = vi.fn(() => ({ where }));
	const select = vi.fn(() => ({ from }));
	return {
		executor: { select } as unknown as DatabaseExecutor,
		select,
		from,
		where,
	};
}

describe("PlatformAuthorization", () => {
	it("decides a capability set with one grant query and preserves implications", async () => {
		const query = grantExecutor([{ capability: "platform.access.manage" }]);
		const authorization = new PlatformAuthorization("00000000-0000-4000-8000-000000000001");

		await expect(
			authorization.decideCapabilities(
				["platform.access.read", "platform.access.manage", "platform.audit.read"],
				query.executor,
			),
		).resolves.toEqual(
			new Map<PlatformCapability, boolean>([
				["platform.access.read", true],
				["platform.access.manage", true],
				["platform.audit.read", false],
			]),
		);
		expect(query.select).toHaveBeenCalledOnce();
		expect(query.from).toHaveBeenCalledOnce();
		expect(query.where).toHaveBeenCalledOnce();
	});

	it("returns anonymous denials without querying grants", async () => {
		const query = grantExecutor([]);
		const authorization = new PlatformAuthorization(undefined);

		await expect(
			authorization.decideCapabilities(
				["platform.access.read", "platform.audit.read"],
				query.executor,
			),
		).resolves.toEqual(
			new Map<PlatformCapability, boolean>([
				["platform.access.read", false],
				["platform.audit.read", false],
			]),
		);
		expect(query.select).not.toHaveBeenCalled();
	});
});
