import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DatabaseTransaction } from "../database";
const mocks = vi.hoisted(() => ({
	representation: vi.fn(),
	notify: vi.fn(),
	subject: vi.fn(),
	scope: vi.fn(),
	reference: vi.fn(),
}));
vi.mock("../authorization/representation-authority", () => ({
	evaluateCurrentRepresentationAuthority: mocks.representation,
}));
vi.mock("../notifications/service", () => ({ createNotification: mocks.notify }));
vi.mock("../authorization/identities", () => ({
	allocateAccessSubject: mocks.subject,
	allocateAccessScope: mocks.scope,
}));
vi.mock("../units/reference-value", () => ({ allocateReferenceValue: mocks.reference }));
import { notifyRealmEnrollment } from "./membership-notifications";
const entity = "019b0000-0000-7000-8000-000000000001",
	actor = "019b0000-0000-7000-8000-000000000002",
	principal = "019b0000-0000-7000-8000-000000000003";
const input: Parameters<typeof notifyRealmEnrollment>[1] = {
	realmId: "019b0000-0000-7000-8000-000000000004",
	operationId: "019b0000-0000-7000-8000-000000000005",
	actorEntityId: actor,
	recipient: { kind: "entity", id: entity },
	basis: {
		principalId: principal,
		selection: {
			mode: "represented",
			entityId: entity,
			representations: [{ id: "019b0000-0000-7000-8000-000000000006", revision: 1 }],
		},
	},
};
function transaction() {
	const execute = vi.fn().mockResolvedValue({ rows: [{ allowed: true }] });
	return { tx: { execute } as unknown as DatabaseTransaction, execute };
}
beforeEach(() => {
	vi.clearAllMocks();
	mocks.representation.mockResolvedValue({ outcome: "allow" });
	mocks.subject.mockResolvedValue(principal);
	mocks.scope.mockResolvedValue(input.realmId);
	mocks.reference.mockResolvedValue(input.realmId);
});
describe("Realm enrollment notice identity", () => {
	it("suppresses same-Entity actions before resolving a private controller inbox", async () => {
		const { tx, execute } = transaction();
		await notifyRealmEnrollment(tx, { ...input, actorEntityId: entity });
		expect(mocks.notify).not.toHaveBeenCalled();
		expect(mocks.representation).not.toHaveBeenCalled();
		expect(execute).not.toHaveBeenCalled();
	});
	it("delivers another Entity's action only to the original currently represented private recipient", async () => {
		const { tx } = transaction();
		await notifyRealmEnrollment(tx, input);
		expect(mocks.notify).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({
				recipientAuthUserId: principal,
				actorProfileId: actor,
				subjectUnitId: input.realmId,
			}),
		);
		expect(mocks.notify).toHaveBeenCalledTimes(1);
	});
	it("does not equate a private principal with an Entity that happens to have the same UUID", async () => {
		const { tx } = transaction();
		await notifyRealmEnrollment(tx, {
			...input,
			actorEntityId: principal,
			recipient: { kind: "principal", id: principal },
			basis: null,
		});
		expect(mocks.notify).toHaveBeenCalledWith(
			tx,
			expect.objectContaining({ recipientAuthUserId: principal, actorProfileId: principal }),
		);
	});
	it("retains denial of a revoked delivery representation", async () => {
		mocks.representation.mockResolvedValue({ outcome: "deny" });
		const { tx } = transaction();
		await notifyRealmEnrollment(tx, input);
		expect(mocks.notify).not.toHaveBeenCalled();
	});
});
