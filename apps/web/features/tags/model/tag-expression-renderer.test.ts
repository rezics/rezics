import { describe, expect, it } from "vitest";

import {
	renderTagExpressions,
	type TagExpressionRenderInput,
	type TagExpressionRenderSource,
} from "./tag-expression-renderer";

const pathSource = (
	applicationId: string,
	pathId: string,
	memberTitles: readonly string[],
): TagExpressionRenderSource => ({
	applicationId,
	sourceKind: "path",
	pathId,
	members: memberTitles.map((title, ordinal) => ({
		nodeId: `${pathId}:${ordinal}`,
		nodeKind: "concept",
		title,
		incomingRelation: ordinal ? { relationKind: "generic" } : null,
	})),
});

const expression = (input: {
	readonly id: string;
	readonly authority?: TagExpressionRenderInput["authority"];
	readonly slot?: { readonly id: string; readonly title: string };
	readonly value: { readonly id: string; readonly title: string };
	readonly sources?: readonly TagExpressionRenderSource[];
}): TagExpressionRenderInput => ({
	authority: input.authority ?? { kind: "global" },
	expression: {
		expressionId: input.id,
		focusTagId: input.value.id,
		components: [
			...(input.slot
				? [
						{
							tagId: input.slot.id,
							semanticRole: "slot" as const,
							componentKind: "required" as const,
							title: input.slot.title,
						},
					]
				: []),
			{
				tagId: input.value.id,
				semanticRole: input.slot ? "value" : "focus",
				componentKind: "required",
				title: input.value.title,
			},
		],
		groupKey: input.slot
			? {
					tagId: input.slot.id,
					semanticRole: "slot",
					title: input.slot.title,
				}
			: null,
	},
	applications: input.sources ?? [
		pathSource(`application:${input.id}`, `path:${input.id}`, [input.value.title]),
	],
});

const context = {
	unknownLabel: "Untitled",
	authorityLabel: (authority: TagExpressionRenderInput["authority"]) =>
		authority.kind === "global" ? "Global" : `Realm ${authority.realmId}`,
	relationLabel: (relation: string) => relation,
} as const;

describe("renderTagExpressions", () => {
	it("renders a deep Path as the Expression's minimal standalone signature", () => {
		const [group] = renderTagExpressions(
			[
				expression({
					id: "hair-red",
					slot: { id: "hair-color", title: "Hair Color" },
					value: { id: "red", title: "Red" },
					sources: [
						pathSource("application:1", "path:1", [
							"Character Traits",
							"Appearance",
							"Hair Color",
							"Red",
						]),
					],
				}),
			],
			context,
		);
		expect(group?.items[0]?.label).toBe("Hair Color · Red");
		expect(group?.items[0]?.displayParts.map(({ label }) => label)).toEqual(["Hair Color", "Red"]);
		expect(group?.items[0]?.displayParts.every(({ source }) => source === "component")).toBe(true);
	});

	it("keeps hair-color Red and eye-color Red as distinct Expressions", () => {
		const groups = renderTagExpressions(
			[
				expression({
					id: "hair-red",
					slot: { id: "hair-color", title: "Hair Color" },
					value: { id: "red", title: "Red" },
				}),
				expression({
					id: "eye-red",
					slot: { id: "eye-color", title: "Eye Color" },
					value: { id: "red", title: "Red" },
				}),
			],
			{ ...context, groupByExpressionKey: true },
		);
		expect(groups.map((group) => group.groupKey?.title)).toEqual(["Hair Color", "Eye Color"]);
		expect(groups.map((group) => group.items[0]?.label)).toEqual(["Red", "Red"]);
	});

	it("aggregates two Path sources only after matching authority and Expression", () => {
		const groups = renderTagExpressions(
			[
				expression({
					id: "hair-red",
					slot: { id: "hair-color", title: "Hair Color" },
					value: { id: "red", title: "Red" },
					sources: [pathSource("application:1", "path:1", ["Hair Color", "Red"])],
				}),
				expression({
					id: "hair-red",
					slot: { id: "hair-color", title: "Hair Color" },
					value: { id: "red", title: "Red" },
					sources: [pathSource("application:2", "path:2", ["Appearance", "Hair Color", "Red"])],
				}),
			],
			context,
		);
		expect(groups).toHaveLength(1);
		expect(groups[0]?.items).toHaveLength(1);
		expect(groups[0]?.items[0]?.applications.map(({ applicationId }) => applicationId)).toEqual([
			"application:1",
			"application:2",
		]);
		expect(groups[0]?.items[0]?.displayParts.map(({ label }) => label)).toEqual([
			"Hair Color",
			"Red",
		]);
	});

	it("never aggregates the same Expression across global and Realm authorities", () => {
		const groups = renderTagExpressions(
			[
				expression({ id: "typescript", value: { id: "typescript-tag", title: "TypeScript" } }),
				expression({
					id: "typescript",
					authority: { kind: "realm", realmId: "realm-1" },
					value: { id: "typescript-tag", title: "TypeScript" },
				}),
			],
			context,
		);
		expect(groups).toHaveLength(1);
		expect(groups.flatMap(({ items }) => items).map(({ key }) => key)).toEqual([
			"global:typescript",
			"realm:realm-1:typescript",
		]);
	});

	it("subtracts context only by semantic ID and role while retaining a value", () => {
		const input: TagExpressionRenderInput = {
			authority: { kind: "global" },
			expression: {
				expressionId: "abc",
				focusTagId: "cc",
				components: [
					{
						tagId: "aa",
						semanticRole: "slot",
						componentKind: "required",
						title: "aa",
					},
					{
						tagId: "bb",
						semanticRole: "qualifier",
						componentKind: "required",
						title: "bb",
					},
					{
						tagId: "cc",
						semanticRole: "value",
						componentKind: "required",
						title: "cc",
					},
				],
				groupKey: null,
			},
			applications: [pathSource("application:abc", "path:abc", ["aa", "bb", "cc"])],
		};
		const groups = renderTagExpressions([input], {
			...context,
			expressedComponents: [{ tagId: "aa", semanticRole: "slot" }],
		});
		expect(groups[0]?.items[0]?.label).toBe("bb · cc");
	});

	it("repairs same-string collisions instead of merging by rendered text", () => {
		const groups = renderTagExpressions(
			[
				expression({
					id: "hair-red",
					slot: { id: "hair-color", title: "Color" },
					value: { id: "red", title: "Red" },
					sources: [pathSource("application:hair", "path:hair", ["Hair", "Color", "Red"])],
				}),
				expression({
					id: "eye-red",
					slot: { id: "eye-color", title: "Color" },
					value: { id: "red", title: "Red" },
					sources: [pathSource("application:eye", "path:eye", ["Eye", "Color", "Red"])],
				}),
			],
			context,
		);
		const items = groups.flatMap(({ items }) => items);
		expect(items).toHaveLength(2);
		expect(new Set(items.map(({ label }) => label)).size).toBe(2);
		expect(items.every(({ collisionRepair }) => collisionRepair === "path_ancestor")).toBe(true);
		expect(items.map(({ displayParts }) => displayParts[0]?.source)).toEqual([
			"path_ancestor",
			"path_ancestor",
		]);
	});

	it("uses configured fallback components before structural Path context", () => {
		const withFallback = (
			input: TagExpressionRenderInput,
			fallback: { readonly id: string; readonly title: string },
		): TagExpressionRenderInput => ({
			...input,
			expression: {
				...input.expression,
				components: [
					...input.expression.components,
					{
						tagId: fallback.id,
						semanticRole: "qualifier",
						componentKind: "fallback",
						title: fallback.title,
					},
				],
			},
		});
		const groups = renderTagExpressions(
			[
				withFallback(
					expression({
						id: "hair-red",
						slot: { id: "hair-color", title: "Color" },
						value: { id: "red", title: "Red" },
						sources: [pathSource("application:hair", "path:hair", ["Hair", "Color", "Red"])],
					}),
					{ id: "hair", title: "Hair" },
				),
				withFallback(
					expression({
						id: "eye-red",
						slot: { id: "eye-color", title: "Color" },
						value: { id: "red", title: "Red" },
						sources: [pathSource("application:eye", "path:eye", ["Eye", "Color", "Red"])],
					}),
					{ id: "eye", title: "Eye" },
				),
			],
			context,
		);
		const items = groups.flatMap(({ items }) => items);

		expect(items.map(({ collisionRepair }) => collisionRepair)).toEqual([
			"fallback_qualifier",
			"fallback_qualifier",
		]);
		expect(items.map(({ displayParts }) => displayParts.map(({ label }) => label))).toEqual([
			["Color", "Red", "Hair"],
			["Color", "Red", "Eye"],
		]);
	});
});
