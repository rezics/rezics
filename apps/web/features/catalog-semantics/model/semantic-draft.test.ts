import { describe, expect, it } from "vitest";
import type { DefinitionRevision } from "@/features/catalog-definitions/model/definition-draft";
import {
	addValueNode,
	buildFactBody,
	buildRelationBody,
	emptyValueNode,
	initialValueDraft,
	removeValueNode,
	setValueUnknown,
	valueDraftFromNodes,
	valueRules,
	type ReadValueNode,
	type ValueNode,
} from "./semantic-draft";
const id = "019b1234-0000-7000-8000-000000000001";
function meaning(valueKind: DefinitionRevision["valueKind"] = "number"): DefinitionRevision {
	return {
		id,
		definitionId: id,
		version: 1,
		valueKind,
		constraints: { nullable: false, integer: false },
		labels: [{ languageTag: "en", label: "Value", description: null }],
		createdAt: "2026-09-08T00:00:00.000Z",
		reviewed: true,
	};
}
function structured() {
	const result = meaning("object");
	result.constraints.rules = [
		{ position: 0, parent: null, memberKey: null, kind: "object", nullable: true, integer: false },
		{ position: 1, parent: 0, memberKey: "items", kind: "array", nullable: false, integer: false },
		{ position: 2, parent: 1, memberKey: null, kind: "string", nullable: false, integer: false },
	];
	return result;
}
describe("semantic authoring boundary", () => {
	it("preserves unconstrained decimal precision in number nodes", () => {
		const definition = meaning(),
			rows = initialValueDraft(definition);
		rows[0] = { ...emptyValueNode(0, null), number: "9007199254740993.125" };
		expect(buildFactBody(definition, rows, 7, 0)?.nodes[0]?.numberValue).toBe(
			"9007199254740993.125",
		);
	});
	it("enforces scalar constraints and nullability", () => {
		const definition = meaning();
		definition.constraints.integer = true;
		const row = { ...emptyValueNode(0, null), number: "9007199254740993" };
		expect(buildFactBody(definition, [row], 1, 0)).toBeNull();
		expect(buildFactBody(definition, [{ ...row, unknown: true }], 1, 0)).toBeNull();
		definition.constraints.nullable = true;
		expect(buildFactBody(definition, [{ ...row, unknown: true }], 1, 0)?.nodes[0]?.kind).toBe(
			"null",
		);
	});
	it("adds only declared children and preserves container relationships", () => {
		const definition = structured(),
			rules = valueRules(definition),
			root = initialValueDraft(definition),
			array = addValueNode(root, rules, 0, 1);
		expect(array).not.toBeNull();
		if (!array) return;
		expect(addValueNode(array, rules, 0, 1)).toBeNull();
		expect(addValueNode(array, rules, 0, 2)).toBeNull();
		const child = addValueNode(array, rules, 1, 2);
		expect(child).not.toBeNull();
		if (!child) return;
		const body = buildFactBody(definition, child, 2, 0);
		expect(body).not.toBeNull();
		if (!body) return;
		expect(body.nodes[2]).toMatchObject({
			parentPosition: 1,
			parentKind: "array",
			memberKey: null,
			kind: "string",
		});
		expect(body.nodes.every((node) => !Object.hasOwn(node, "rulePosition"))).toBe(true);
		const readNodes: ReadValueNode[] = [
			{ ...body.nodes[0]!, rulePosition: 0 },
			{ ...body.nodes[1]!, rulePosition: 1 },
			{ ...body.nodes[2]!, rulePosition: 2 },
		];
		expect(valueDraftFromNodes(definition, readNodes)).toEqual(child);
	});
	it("uses persisted rulePosition to disambiguate identical member keys", () => {
		const definition = meaning("object");
		definition.constraints.rules = [
			{ position: 0, parent: null, memberKey: null, kind: "object", nullable: true, integer: false },
			{ position: 1, parent: 0, memberKey: "left", kind: "object", nullable: false, integer: false },
			{ position: 2, parent: 0, memberKey: "right", kind: "object", nullable: false, integer: false },
			{ position: 3, parent: 1, memberKey: "name", kind: "string", nullable: false, integer: false },
			{ position: 4, parent: 2, memberKey: "name", kind: "string", nullable: false, integer: false },
		];
		const rows = [
			emptyValueNode(0, null),
			emptyValueNode(1, 0),
			emptyValueNode(2, 0),
			{ ...emptyValueNode(3, 1), text: "L" },
			{ ...emptyValueNode(4, 2), text: "R" },
		];
		const written = buildFactBody(definition, rows, 1, 0);
		expect(written).not.toBeNull();
		if (!written) return;
		expect(written.nodes.map((node) => node.memberKey)).toEqual([null, "left", "right", "name", "name"]);
		expect(written.nodes.every((node: ValueNode) => !Object.hasOwn(node, "rulePosition"))).toBe(true);
		const readNodes: ReadValueNode[] = [
			{ ...written.nodes[0]!, rulePosition: 0 },
			{ ...written.nodes[1]!, rulePosition: 1 },
			{ ...written.nodes[2]!, rulePosition: 2 },
			{ ...written.nodes[3]!, rulePosition: 3 },
			{ ...written.nodes[4]!, rulePosition: 4 },
		];
		expect(valueDraftFromNodes(definition, readNodes)).toEqual(rows);
		expect(
			valueDraftFromNodes(definition, [
				readNodes[0]!,
				readNodes[1]!,
				readNodes[2]!,
				{ ...readNodes[3]!, rulePosition: 4 },
				{ ...readNodes[4]!, rulePosition: 3 },
			]),
		).toBeNull();
		expect(
			valueDraftFromNodes(definition, [
				readNodes[0]!,
				readNodes[1]!,
				readNodes[2]!,
				{ ...readNodes[3]!, parentPosition: 2 },
				readNodes[4]!,
			]),
		).toBeNull();
	});
	it("removes a complete subtree and clears children for an unknown container", () => {
		const rows = [
			emptyValueNode(0, null),
			emptyValueNode(1, 0),
			emptyValueNode(2, 1),
			emptyValueNode(2, 1),
		];
		expect(removeValueNode(rows, 1)).toEqual([rows[0]]);
		expect(setValueUnknown(rows, 0, true)).toEqual([{ ...rows[0], unknown: true }]);
	});
	it("never truncates a fact to fit the command budget", () => {
		const definition = meaning("string"),
			row = { ...emptyValueNode(0, null), text: "字".repeat(180000) };
		expect(buildFactBody(definition, [row], 1, 0)).toBeNull();
		expect(
			buildFactBody(
				definition,
				Array.from({ length: 513 }, () => emptyValueNode(0, null)),
				1,
				0,
			),
		).toBeNull();
	});
	it("enforces exact predicate role targets and minimum cardinality", () => {
		const definition = meaning(null);
		definition.constraints.roles = [
			{ roleRevisionId: id, min: 1, max: 1, targets: [{ owner: "entity", shapes: ["person"] }] },
		];
		expect(buildRelationBody(definition, [], [], 1, 0)).toBeNull();
		const participant = {
			roleRevisionId: id,
			creditedAs: "",
			target: { reference: { owner: "entity" as const, id }, shape: "person", label: "Person" },
		};
		expect(buildRelationBody(definition, [participant], [], 1, 0)?.participants).toEqual([
			{ roleRevisionId: id, target: participant.target.reference },
		]);
		expect(
			buildRelationBody(
				definition,
				[{ ...participant, target: { ...participant.target, shape: "organization" } }],
				[],
				1,
				0,
			),
		).toBeNull();
		expect(buildRelationBody(definition, [participant, participant], [], 1, 0)).toBeNull();
	});
});
