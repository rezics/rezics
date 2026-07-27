import { describe, expect, it } from "vitest";

import type { DatabaseExecutor } from "../database";
import { runWithAuditRequestContext } from "./context";
import { recordAuditEvent } from "./service";

function capturingExecutor(rows: Record<string, unknown>[]): DatabaseExecutor {
	return {
		insert() {
			return {
				values(value: Record<string, unknown>) {
					rows.push(value);
					return Promise.resolve();
				},
			};
		},
	} as unknown as DatabaseExecutor;
}

describe("security audit writer", () => {
	it("inherits request credentials only for a Profile actor", async () => {
		const rows: Record<string, unknown>[] = [];
		const executor = capturingExecutor(rows);

		await runWithAuditRequestContext(
			{
				requestId: "request-1",
				credentialKind: "api_token",
				credentialId: "token-1",
			},
			async () => {
				await recordAuditEvent(executor, {
					category: "admin_activity",
					outcome: "succeeded",
					actor: {
						kind: "profile",
						profileId: "01900000-0000-7000-8000-000000000001",
					},
					authority: {
						kind: "realm",
						id: "01900000-0000-7000-8000-000000000002",
					},
					action: "realm.settings.update",
				});
				await recordAuditEvent(executor, {
					category: "system_event",
					outcome: "succeeded",
					actor: { kind: "system" },
					authority: { kind: "platform" },
					action: "system.reconcile",
				});
			},
		);

		expect(rows).toHaveLength(2);
		expect(rows[0]).toMatchObject({
			actorCredentialKind: "api_token",
			actorCredentialId: "token-1",
			authorityKind: "realm",
			requestId: "request-1",
		});
		expect(rows[1]).toMatchObject({
			actorCredentialKind: "system",
			authorityKind: "platform",
			authorityId: null,
			requestId: "request-1",
		});
		expect(rows[1]?.actorCredentialId).toBeUndefined();
	});
});
