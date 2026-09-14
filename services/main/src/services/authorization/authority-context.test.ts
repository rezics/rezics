import { describe, expect, it } from "vitest";
import {
	evaluateAuthorityContext,
	RequestedAuthoritySelectionSchema,
	type AuthorityEvaluationInput,
	type AuthorityOperation,
} from "./authority-context";

const actor = "018f2daa-62d9-7b41-8d20-29d221e63f52";
const entity = "018f2daa-62d9-7b41-8d20-29d221e63f53";
const scopeId = "018f2daa-62d9-7b41-8d20-29d221e63f54";
const grant = { id: "018f2daa-62d9-7b41-8d20-29d221e63f55", revision: 1 };
const read: AuthorityOperation = { permission: "unit.read", scopeId, path: [] };
const update: AuthorityOperation = { permission: "unit.update", scopeId, path: [] };
function fixture(): AuthorityEvaluationInput {
	return {
		principalId: actor,
		selection: { mode: "represented", entityId: entity, representations: [grant] },
		operations: [{ ...read, path: [] }],
		now: 1000,
		actor: { principalId: actor, outcome: "allow" },
		credential: {
			principalId: actor,
			authority: { mode: "represented", entityId: entity, representations: [grant] },
			decisions: [{ operation: { ...read, path: [] }, outcome: "allow" }],
		},
		resourceDecisions: [
			{
				principalId: actor,
				subject: { kind: "entity", id: entity },
				operation: { ...read, path: [] },
				outcome: "allow",
			},
		],
		representations: [
			{
				principalId: actor,
				entityId: entity,
				grant,
				decisions: [{ operation: { ...read, path: [] }, outcome: "allow" }],
			},
		],
	};
}

describe("explicit authority selection", () => {
	it.each([
		{ mode: "direct", principalId: actor },
		{ mode: "represented", entityId: entity, representations: [] },
		{ mode: "represented", entityId: entity, representations: [grant, grant] },
		{ mode: "represented", entityId: entity, representations: [{ ...grant, revision: 0 }] },
		{
			mode: "represented",
			entityId: entity,
			representations: [{ ...grant, revision: Number.MAX_SAFE_INTEGER + 1 }],
		},
		{ mode: "represented", entityId: entity, representations: [grant], principalId: actor },
	])("rejects caller-selected private actors and ambiguous representation bases", (selection) => {
		expect(RequestedAuthoritySelectionSchema.safeParse(selection).success).toBe(false);
	});
	it("allows represented authority without any direct resource grant to the operator", () => {
		expect(evaluateAuthorityContext(fixture())).toBe("allow");
	});
	it("does not import the operator's unrelated private permissions", () => {
		const input = fixture();
		input.resourceDecisions[0]!.outcome = "deny";
		input.resourceDecisions.push({
			principalId: actor,
			subject: { kind: "principal", id: actor },
			operation: { ...read, path: [] },
			outcome: "allow",
		});
		expect(evaluateAuthorityContext(input)).toBe("deny");
	});
	it("cannot stitch a composite operation across identities", () => {
		const input = fixture();
		input.operations.push(update);
		input.credential.decisions.push({ operation: update, outcome: "allow" });
		input.representations[0]!.decisions.push({ operation: update, outcome: "allow" });
		input.resourceDecisions.push({
			principalId: actor,
			subject: { kind: "principal", id: actor },
			operation: update,
			outcome: "allow",
		});
		expect(evaluateAuthorityContext(input)).not.toBe("allow");
	});
	it("requires representation independently from the Entity's resource rights", () => {
		const input = fixture();
		input.representations = [];
		expect(evaluateAuthorityContext(input)).toBe("deny");
	});
	it("rejects stale, wrong-actor and wrong-Entity representation evidence", () => {
		for (const change of [
			{ grant: { ...grant, revision: 2 } },
			{ principalId: entity },
			{ entityId: actor },
		]) {
			const input = fixture();
			Object.assign(input.representations[0]!, change);
			expect(evaluateAuthorityContext(input)).toBe("deny");
		}
	});
	it("keeps credential subject limits when direct rights would otherwise allow", () => {
		const input = fixture();
		input.selection = { mode: "direct" };
		input.resourceDecisions = [
			{
				principalId: actor,
				subject: { kind: "principal", id: actor },
				operation: { ...read, path: [] },
				outcome: "allow",
			},
		];
		expect(evaluateAuthorityContext(input)).toBe("deny");
		input.credential.authority = { mode: "operator" };
		expect(evaluateAuthorityContext(input)).toBe("allow");
	});
	it("distinguishes subject kinds even when their native UUIDs are equal", () => {
		const input = fixture();
		input.selection = { mode: "direct" };
		input.credential.authority = { mode: "operator" };
		input.resourceDecisions[0]!.subject = { kind: "entity", id: actor };
		expect(evaluateAuthorityContext(input)).not.toBe("allow");
	});
	it("binds decisions to the exact action, root and path", () => {
		for (const change of [
			{ permission: "unit.update" as const },
			{ scopeId: actor },
			{ path: ["child"] },
		]) {
			const input = fixture();
			Object.assign(input.resourceDecisions[0]!.operation, change);
			expect(evaluateAuthorityContext(input)).not.toBe("allow");
		}
	});
	it("rejects expired evidence and preserves unavailable decisions", () => {
		const input = fixture();
		input.resourceDecisions[0]!.validUntil = 1000;
		expect(evaluateAuthorityContext(input)).toBe("unavailable");
		input.resourceDecisions[0]!.validUntil = 1001;
		expect(evaluateAuthorityContext(input)).toBe("allow");
		input.actor.outcome = "unavailable";
		expect(evaluateAuthorityContext(input)).toBe("unavailable");
	});
	it("retains hard actor and credential denial despite valid representation", () => {
		const input = fixture();
		input.actor.outcome = "deny";
		expect(evaluateAuthorityContext(input)).toBe("deny");
		input.actor.outcome = "allow";
		input.credential.decisions[0]!.outcome = "deny";
		expect(evaluateAuthorityContext(input)).toBe("deny");
	});
	it("combines independent valid representations only for the same selected Entity", () => {
		const input = fixture();
		input.operations.push(update);
		input.credential.decisions.push({ operation: update, outcome: "allow" });
		input.resourceDecisions.push({
			principalId: actor,
			subject: { kind: "entity", id: entity },
			operation: update,
			outcome: "allow",
		});
		const second = { id: scopeId, revision: 1 };
		if (input.selection.mode !== "represented") throw new Error("fixture");
		input.selection.representations.push(second);
		input.credential.authority = { mode: "operator" };
		input.representations.push({
			principalId: actor,
			entityId: entity,
			grant: second,
			decisions: [{ operation: update, outcome: "allow" }],
		});
		expect(evaluateAuthorityContext(input)).toBe("allow");
	});
	it("fails closed on conflicting duplicate decisions and unbounded work", () => {
		const input = fixture();
		input.resourceDecisions.push({ ...input.resourceDecisions[0]!, outcome: "deny" });
		expect(evaluateAuthorityContext(input)).toBe("unavailable");
		const large = fixture();
		large.operations = Array.from({ length: 65 }, () => read);
		expect(evaluateAuthorityContext(large)).toBe("unavailable");
	});
	it("rejects conflicting or repeated facts for one representation basis", () => {
		for (const replacement of [
			{ grant, outcome: "deny" as const },
			{ grant: { ...grant, revision: 2 }, outcome: "deny" as const },
		]) {
			const input = fixture();
			input.representations.push({
				principalId: actor,
				entityId: entity,
				grant: replacement.grant,
				decisions: [{ operation: read, outcome: replacement.outcome }],
			});
			expect(evaluateAuthorityContext(input)).toBe("unavailable");
		}
	});
	it("does not select an unapproved basis through an otherwise valid bound credential", () => {
		const input = fixture();
		if (input.selection.mode !== "represented") throw new Error("fixture");
		input.selection.representations.push({ id: scopeId, revision: 1 });
		expect(evaluateAuthorityContext(input)).toBe("deny");
	});
	it("does not reuse actor-conditioned resource decisions for another operator", () => {
		const input = fixture();
		input.resourceDecisions[0]!.principalId = entity;
		expect(evaluateAuthorityContext(input)).toBe("unavailable");
	});
	it("rejects invalid time, oversized scopes and excess evidence", () => {
		const invalidTime = fixture();
		invalidTime.now = Number.NaN;
		expect(evaluateAuthorityContext(invalidTime)).toBe("unavailable");
		const wide = fixture();
		wide.operations[0]!.path = ["a".repeat(257)];
		expect(evaluateAuthorityContext(wide)).toBe("unavailable");
		const huge = fixture();
		huge.resourceDecisions = Array.from({ length: 257 }, () => huge.resourceDecisions[0]!);
		expect(evaluateAuthorityContext(huge)).toBe("unavailable");
	});
	it("admits a complete boundary-sized request and rejects the next fact", () => {
		const input = fixture();
		const operations: AuthorityOperation[] = Array.from({ length: 64 }, (_, index) => ({
			permission: "unit.read",
			scopeId,
			path: [`item-${index}`],
		}));
		const references = operations.map((_, index) => ({
			id: `018f2daa-62d9-7b41-8d20-${(index + 1).toString(16).padStart(12, "0")}`,
			revision: 1,
		}));
		input.selection = { mode: "represented", entityId: entity, representations: references };
		input.operations = operations;
		input.credential.authority = { mode: "operator" };
		input.credential.decisions = operations.map((operation) => ({ operation, outcome: "allow" }));
		input.resourceDecisions = operations.flatMap((operation) => [
			{
				principalId: actor,
				subject: { kind: "entity" as const, id: entity },
				operation,
				outcome: "allow" as const,
			},
			{
				principalId: entity,
				subject: { kind: "entity" as const, id: entity },
				operation,
				outcome: "allow" as const,
			},
		]);
		input.representations = operations.map((operation, index) => ({
			principalId: actor,
			entityId: entity,
			grant: references[index]!,
			decisions: [{ operation, outcome: "allow" }],
		}));
		expect(evaluateAuthorityContext(input)).toBe("allow");
		input.resourceDecisions.push(input.resourceDecisions[0]!);
		expect(evaluateAuthorityContext(input)).toBe("unavailable");
	});
	it("uses a current independent basis when another selected path is unavailable", () => {
		const input = fixture();
		const other = { id: scopeId, revision: 1 };
		if (input.selection.mode !== "represented") throw new Error("fixture");
		input.selection.representations.push(other);
		input.credential.authority = { mode: "operator" };
		input.representations.push({
			principalId: actor,
			entityId: entity,
			grant: other,
			decisions: [{ operation: read, outcome: "unavailable" }],
		});
		expect(evaluateAuthorityContext(input)).toBe("allow");
		input.resourceDecisions[0]!.outcome = "deny";
		expect(evaluateAuthorityContext(input)).toBe("deny");
	});
});
