import { describe, expect, it } from "vitest";

import { ContentStructureInvalid } from "./errors";
import {
	planRealmTaxonomyDraft,
	type CurrentRealmTaxonomyDraftNode,
	type ResolvedRealmTaxonomyDraftNode,
} from "./realm-taxonomy-draft-plan";

const labelId = "019fa320-0000-7000-8000-000000000001";
const tagId = "019fa320-0000-7000-8000-000000000002";
const wikiId = "019fa320-0000-7000-8000-000000000003";

const current: readonly CurrentRealmTaxonomyDraftNode[] = [
	{
		id: labelId,
		parentId: null,
		position: "a0",
		contentUnitId: "019fa321-0000-7000-8000-000000000001",
		contentKind: "label",
		queryStrategy: null,
	},
	{
		id: tagId,
		parentId: labelId,
		position: "a0",
		contentUnitId: "019fa321-0000-7000-8000-000000000002",
		contentKind: "tag",
		queryStrategy: "global_effective",
	},
];

function existing(
	node: CurrentRealmTaxonomyDraftNode,
	order: number,
	overrides: Partial<ResolvedRealmTaxonomyDraftNode> = {},
): ResolvedRealmTaxonomyDraftNode {
	return {
		state: "existing",
		id: node.id,
		parentId: node.parentId,
		order,
		contentUnitId: node.contentUnitId,
		contentKind: node.contentKind,
		queryStrategy: node.queryStrategy,
		...overrides,
	};
}

describe("planRealmTaxonomyDraft", () => {
	it("treats an unchanged complete draft as a semantic no-op", () => {
		const plan = planRealmTaxonomyDraft(current, [
			existing(current[0]!, 0),
			existing(current[1]!, 0),
		]);

		expect(plan.hasChanges).toBe(false);
		expect(plan.deletedNodeIds.size).toBe(0);
	});

	it("supports promotion, deletion, insertion, and strategy edits in one draft", () => {
		const plan = planRealmTaxonomyDraft(current, [
			existing(current[1]!, 0, {
				parentId: null,
				queryStrategy: "realm_policy",
			}),
			{
				state: "new",
				id: wikiId,
				parentId: null,
				order: 1,
				contentUnitId: "019fa321-0000-7000-8000-000000000003",
				contentKind: "wiki",
				queryStrategy: null,
			},
		]);

		expect(plan.hasChanges).toBe(true);
		expect(plan.hasStructuralChanges).toBe(true);
		expect(plan.deletedNodeIds).toEqual(new Set([labelId]));
		expect(plan.nodes.find(({ id }) => id === tagId)).toMatchObject({
			parentId: null,
			queryStrategy: "realm_policy",
		});
	});

	it("rejects duplicate Tags", () => {
		const duplicate: ResolvedRealmTaxonomyDraftNode = {
			state: "new",
			id: wikiId,
			parentId: labelId,
			order: 1,
			contentUnitId: current[1]!.contentUnitId,
			contentKind: "tag",
			queryStrategy: "realm_community",
		};

		expect(() =>
			planRealmTaxonomyDraft(current, [
				existing(current[0]!, 0),
				existing(current[1]!, 0),
				duplicate,
			]),
		).toThrow(ContentStructureInvalid);
	});

	it("rejects cycles and non-contiguous sibling orders", () => {
		expect(() =>
			planRealmTaxonomyDraft(current, [
				existing(current[0]!, 0, { parentId: tagId }),
				existing(current[1]!, 0, { parentId: labelId }),
			]),
		).toThrow(/cycle/);

		expect(() =>
			planRealmTaxonomyDraft(current, [
				existing(current[0]!, 0),
				existing(current[1]!, 0),
				{
					state: "new",
					id: wikiId,
					parentId: null,
					order: 2,
					contentUnitId: "019fa321-0000-7000-8000-000000000003",
					contentKind: "wiki",
					queryStrategy: null,
				},
			]),
		).toThrow(/contiguous/);
	});

	it("rejects query strategies on non-Tag nodes", () => {
		expect(() =>
			planRealmTaxonomyDraft(current, [
				existing(current[0]!, 0, { queryStrategy: "realm_policy" }),
				existing(current[1]!, 0),
			]),
		).toThrow(/query strategy/);
	});
});
