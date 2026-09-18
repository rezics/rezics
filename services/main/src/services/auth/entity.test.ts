import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
	rows: new Map<unknown, unknown[]>(),
	inserts: new Map<unknown, unknown[]>(),
	create: vi.fn(),
}));
vi.mock("../database", () => ({
	database: {
		transaction: async (work: (tx: unknown) => unknown) =>
			work({
				select: () => ({
					from: (table: unknown) => {
						const query = {
							innerJoin: () => query,
							where: () => query,
							orderBy: () => query,
							limit: () => query,
							for: async () => state.rows.get(table) ?? [],
							then: (resolve: (rows: unknown[]) => unknown) => resolve(state.rows.get(table) ?? []),
						};
						return query;
					},
				}),
				insert: (table: unknown) => ({
					values: (value: unknown) => {
						state.inserts.set(table, [...(state.inserts.get(table) ?? []), value]);
						return {
							onConflictDoNothing: async () => {},
							then: (resolve: (value: undefined) => unknown) => resolve(undefined),
						};
					},
				}),
			}),
	},
}));
vi.mock("./account-defaults", () => ({ initializeAccountParticipation: vi.fn() }));
vi.mock("../participation/identity", () => ({ createParticipantIdentity: state.create }));

import { users } from "@rezics/schema/postgres/identity/auth";
import { accountPreference } from "@rezics/schema/postgres/identity/account-preference";
import { authEntity } from "@rezics/schema/postgres/access/participation";
import { entityPresentation } from "@rezics/schema/postgres/identity/entity-presentation";
import { ensureSelfEntity } from "./entity";

const account = {
	id: "019f9ea5-5188-7f3a-8819-380ec28c0b11",
	name: "Reader",
	email: "private@example.com",
	image: null,
};
const id = "019f9ea5-5188-7f3a-8819-380ec28c0b12";
beforeEach(() => {
	state.rows.clear();
	state.inserts.clear();
	state.create.mockReset();
	state.rows.set(users, [{ id: account.id, language: "ja", principalKind: "human" }]);
	state.create.mockResolvedValue({ owner: "entity", id, revision: 1 });
});

describe("Auth self Entity lifecycle", () => {
	it("creates distinct public identity and private preferences without publishing email", async () => {
		const result = await ensureSelfEntity(account, "zh-Hans");
		expect(result).toEqual({ id, name: "Reader", authorizationRevision: 1 });
		expect(state.inserts.get(authEntity)).toEqual([{ authUserId: account.id, entityId: id }]);
		expect(state.inserts.get(accountPreference)).toEqual([
			{ authUserId: account.id, interfaceLocale: "zh-Hans", preferredLanguages: ["ja"] },
		]);
		expect(JSON.stringify(state.create.mock.calls)).not.toContain(account.email);
	});
	it("preserves the existing public name instead of recreating identity or synchronizing login name", async () => {
		state.rows.set(authEntity, [{ entityId: id, revision: 7, state: "active" }]);
		state.rows.set(entityPresentation, [{ value: "Public pen name" }]);
		expect(await ensureSelfEntity(account)).toEqual({
			id,
			name: "Public pen name",
			authorizationRevision: 7,
		});
		expect(state.create).not.toHaveBeenCalled();
	});
	it("rejects service accounts and suspended self bindings", async () => {
		state.rows.set(users, [{ id: account.id, language: "en", principalKind: "service" }]);
		await expect(ensureSelfEntity(account)).rejects.toThrow();
		state.rows.set(users, [{ id: account.id, language: "en", principalKind: "human" }]);
		state.rows.set(authEntity, [{ entityId: id, revision: 2, state: "suspended" }]);
		await expect(ensureSelfEntity(account)).rejects.toThrow();
		expect(state.create).not.toHaveBeenCalled();
	});
	it("does not expose a provider sign-in name that is the private email address", async () => {
		const result = await ensureSelfEntity({ ...account, name: account.email });
		expect(result.name).toBeNull();
		expect(state.create).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({ names: [] }),
		);
	});
});
