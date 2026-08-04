import type { ContentLanguage } from "@rezics/i18n";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";

import type { DatabaseTransaction } from "../database";
import {
	contentStructure,
	contentStructureNode,
	label,
	post,
	realmUnit,
	tag,
	unit,
	unitLocalization,
	unitOwnership,
} from "../database/schema";
import type { RealmTagQueryStrategy } from "../database/schema/contract-values";
import { insertUnit } from "../units/create";
import { recordUnitRevision } from "../units/history";
import { revisionedBatchChunks } from "../history/revisioned-batch";
import { diffContentStructureSnapshots } from "./contracts";
import { assertContentStructureDraftCommandLimit } from "./draft-batch";
import { ContentStructureInvalid, ContentStructureNotFound } from "./errors";
import { mutateContentStructureWithHistory } from "./history";
import {
	planRealmTaxonomyDraft,
	type CurrentRealmTaxonomyDraftNode,
	type RealmTaxonomyContentKind,
	type ResolvedRealmTaxonomyDraftNode,
} from "./realm-taxonomy-draft-plan";
import { loadContentStructureSnapshot } from "./storage";

export type RealmTaxonomyDraftNode =
	| {
			readonly state: "existing";
			readonly id: string;
			readonly parentId: string | null;
			readonly order: number;
			readonly queryStrategy: RealmTagQueryStrategy | null;
	  }
	| {
			readonly state: "new";
			readonly id: string;
			readonly parentId: string | null;
			readonly order: number;
			readonly queryStrategy: null;
			readonly content: {
				readonly kind: "label";
				readonly language: ContentLanguage;
				readonly title: string;
			};
	  }
	| {
			readonly state: "new";
			readonly id: string;
			readonly parentId: string | null;
			readonly order: number;
			readonly queryStrategy: RealmTagQueryStrategy | null;
			readonly content: { readonly kind: "unit"; readonly unitId: string };
	  };

export type SaveRealmTaxonomyDraftInput = {
	readonly ownerUnitId: string;
	readonly baseRevisionId: string;
	readonly actorProfileId: string;
	readonly nodes: readonly RealmTaxonomyDraftNode[];
};

function contentKind(row: {
	readonly unitKind: string;
	readonly postKind: string | null;
	readonly tagId: string | null;
	readonly labelId: string | null;
}): RealmTaxonomyContentKind {
	if (row.unitKind === "tag" && row.tagId) return "tag";
	if (row.unitKind === "label" && row.labelId) return "label";
	if (row.unitKind === "post" && row.postKind === "wiki") return "wiki";
	throw new ContentStructureInvalid("Realm taxonomy contains an invalid content Unit");
}

async function createDraftLabel(
	tx: DatabaseTransaction,
	input: {
		readonly actorProfileId: string;
		readonly language: ContentLanguage;
		readonly title: string;
	},
): Promise<string> {
	const title = input.title.trim();
	if (!title) throw new ContentStructureInvalid("Realm taxonomy Label title is blank");
	const created = await insertUnit(tx, {
		kind: "label",
		status: "published",
		visibility: "public",
		publishedAt: new Date(),
		statusActor: { kind: "profile", profileId: input.actorProfileId },
	});
	await tx.insert(label).values({ id: created.id });
	await tx.insert(unitLocalization).values({
		unitId: created.id,
		language: input.language,
		title,
	});
	await tx.insert(unitOwnership).values({
		unitId: created.id,
		profileId: input.actorProfileId,
		assignedByProfileId: input.actorProfileId,
	});
	await recordUnitRevision(tx, {
		unitId: created.id,
		actorProfileId: input.actorProfileId,
		event: "create",
	});
	return created.id;
}

/**
 * Persists one complete Realm taxonomy draft and commits at most one Content
 * Structure revision.
 */
export async function saveRealmTaxonomyDraft(
	tx: DatabaseTransaction,
	input: SaveRealmTaxonomyDraftInput,
) {
	const [structure] = await tx
		.select()
		.from(contentStructure)
		.where(
			and(
				eq(contentStructure.ownerUnitId, input.ownerUnitId),
				eq(contentStructure.kind, "realm.taxonomy"),
				isNull(contentStructure.deletedAt),
			),
		)
		.limit(1);
	if (!structure) throw new ContentStructureNotFound();

	return mutateContentStructureWithHistory(
		tx,
		{
			structureId: structure.id,
			baseRevisionId: input.baseRevisionId,
			actorProfileId: input.actorProfileId,
		},
		async () => {
			const before = await loadContentStructureSnapshot(tx, {
				structureId: structure.id,
				ownerUnitId: input.ownerUnitId,
			});
			if (before.structure.kind !== "realm.taxonomy")
				throw new ContentStructureInvalid(
					"Realm taxonomy draft targets another Content Structure kind",
				);
			const currentRows = await tx
				.select({
					id: contentStructureNode.id,
					parentId: contentStructureNode.parentId,
					position: contentStructureNode.position,
					contentUnitId: contentStructureNode.contentUnitId,
					queryStrategy: contentStructureNode.realmTagQueryStrategy,
					unitKind: unit.kind,
					postKind: post.kind,
					tagId: tag.id,
					labelId: label.id,
				})
				.from(contentStructureNode)
				.innerJoin(unit, eq(unit.id, contentStructureNode.contentUnitId))
				.leftJoin(post, eq(post.id, contentStructureNode.contentUnitId))
				.leftJoin(tag, eq(tag.id, contentStructureNode.contentUnitId))
				.leftJoin(label, eq(label.id, contentStructureNode.contentUnitId))
				.where(
					and(
						eq(contentStructureNode.structureId, structure.id),
						isNull(contentStructureNode.deletedAt),
					),
				)
				.orderBy(asc(contentStructureNode.position), asc(contentStructureNode.id));
			const current: CurrentRealmTaxonomyDraftNode[] = currentRows.map((row) => ({
				id: row.id,
				parentId: row.parentId,
				position: row.position,
				contentUnitId: row.contentUnitId,
				contentKind: contentKind(row),
				queryStrategy: row.queryStrategy,
			}));
			const currentById = new Map(current.map((node) => [node.id, node]));
			const newUnitIds = input.nodes.flatMap((node) =>
				node.state === "new" && node.content.kind === "unit" ? [node.content.unitId] : [],
			);
			const newUnitRows = [];
			for (const newIds of revisionedBatchChunks(newUnitIds))
				newUnitRows.push(
					...(await tx
						.select({
							id: unit.id,
							unitKind: unit.kind,
							postKind: post.kind,
							tagId: tag.id,
							labelId: label.id,
						})
						.from(unit)
						.leftJoin(post, eq(post.id, unit.id))
						.leftJoin(tag, eq(tag.id, unit.id))
						.leftJoin(label, eq(label.id, unit.id))
						.where(and(inArray(unit.id, newIds), isNull(unit.deletedAt)))),
				);
			const newUnitById = new Map(
				newUnitRows.map((row) => [
					row.id,
					{ contentUnitId: row.id, contentKind: contentKind(row) },
				]),
			);
			const wikiUnitIds = newUnitRows
				.filter((row) => row.unitKind === "post" && row.postKind === "wiki")
				.map(({ id }) => id);
			if (wikiUnitIds.length) {
				const mountedIds = new Set<string>();
				for (const wikiIds of revisionedBatchChunks(wikiUnitIds)) {
					const mounted = await tx
						.select({ unitId: realmUnit.unitId })
						.from(realmUnit)
						.where(
							and(
								eq(realmUnit.realmId, input.ownerUnitId),
								inArray(realmUnit.unitId, wikiIds),
								eq(realmUnit.status, "visible"),
								eq(realmUnit.publicationState, "active"),
							),
						);
					for (const { unitId } of mounted) mountedIds.add(unitId);
				}
				if (wikiUnitIds.some((id) => !mountedIds.has(id)))
					throw new ContentStructureInvalid(
						"Realm taxonomy can only attach Wiki Posts mounted in this Realm",
					);
			}
			const resolved: ResolvedRealmTaxonomyDraftNode[] = input.nodes.map((node) => {
				if (node.state === "existing") {
					const existing = currentById.get(node.id);
					if (!existing)
						throw new ContentStructureInvalid(
							`Realm taxonomy node ${node.id} does not exist`,
						);
					return {
						...node,
						contentUnitId: existing.contentUnitId,
						contentKind: existing.contentKind,
					};
				}
				if (node.content.kind === "label")
					return {
						state: node.state,
						id: node.id,
						parentId: node.parentId,
						order: node.order,
						contentUnitId: null,
						contentKind: "label",
						queryStrategy: null,
					};
				const content = newUnitById.get(node.content.unitId);
				if (!content)
					throw new ContentStructureInvalid(
						`Realm taxonomy content Unit ${node.content.unitId} is unavailable`,
					);
				return { ...node, ...content };
			});
			const plan = planRealmTaxonomyDraft(current, resolved);
			if (!plan.hasChanges) return { result: {} };
			assertContentStructureDraftCommandLimit({
				currentNodes: current,
				deletedNodeIds: plan.deletedNodeIds,
				changedDesiredNodeCount: plan.nodes.filter((node) => {
					const previous = currentById.get(node.id);
					return (
						!previous ||
						previous.parentId !== node.parentId ||
						previous.position !== node.position ||
						previous.queryStrategy !== node.queryStrategy
					);
				}).length,
			});

			const movedExistingIds = plan.nodes
				.filter((node) => {
					const previous = currentById.get(node.id);
					return previous && previous.parentId !== node.parentId;
				})
				.map(({ id }) => id);
			if (movedExistingIds.length)
				await tx
					.update(contentStructureNode)
					.set({ parentId: null })
					.where(
						and(
							eq(contentStructureNode.structureId, structure.id),
							inArray(contentStructureNode.id, movedExistingIds),
							isNull(contentStructureNode.deletedAt),
						),
					);
			for (const deletedIds of revisionedBatchChunks([...plan.deletedNodeIds]))
				await tx
					.update(contentStructureNode)
					.set({ deletedAt: new Date() })
					.where(
						and(
							eq(contentStructureNode.structureId, structure.id),
							inArray(contentStructureNode.id, deletedIds),
							isNull(contentStructureNode.deletedAt),
						),
					);

			const inputById = new Map(input.nodes.map((node) => [node.id, node]));
			const newNodeIds = plan.nodes
				.filter(({ state }) => state === "new")
				.map(({ id }) => id);
			if (newNodeIds.length) {
				const collision = await tx
					.select({ id: contentStructureNode.id })
					.from(contentStructureNode)
					.where(inArray(contentStructureNode.id, newNodeIds))
					.limit(1);
				if (collision.length)
					throw new ContentStructureInvalid(
						"New Realm taxonomy draft node ID already exists",
					);
			}
			for (const node of plan.nodes) {
				if (node.state !== "new") continue;
				const source = inputById.get(node.id);
				if (!source || source.state !== "new")
					throw new ContentStructureInvalid(
						"New Realm taxonomy node source is unavailable",
					);
				const contentUnitId =
					source.content.kind === "label"
						? await createDraftLabel(tx, {
								actorProfileId: input.actorProfileId,
								language: source.content.language,
								title: source.content.title,
							})
						: source.content.unitId;
				await tx.insert(contentStructureNode).values({
					id: node.id,
					structureId: structure.id,
					ownerUnitId: input.ownerUnitId,
					parentId: null,
					contentUnitId,
					position: node.position,
					realmTagQueryStrategy: node.queryStrategy,
				});
			}

			for (const node of plan.nodes) {
				const previous = currentById.get(node.id);
				if (
					previous &&
					previous.parentId === node.parentId &&
					previous.position === node.position &&
					previous.queryStrategy === node.queryStrategy
				)
					continue;
				await tx
					.update(contentStructureNode)
					.set({
						parentId: node.parentId,
						position: node.position,
						realmTagQueryStrategy: node.queryStrategy,
					})
					.where(
						and(
							eq(contentStructureNode.id, node.id),
							eq(contentStructureNode.structureId, structure.id),
							isNull(contentStructureNode.deletedAt),
						),
					);
			}

			const nextUpdatedAt = new Date(
				Math.max(Date.now(), before.structure.updatedAt.getTime() + 1),
			);
			await tx
				.update(contentStructure)
				.set({ updatedAt: nextUpdatedAt })
				.where(eq(contentStructure.id, structure.id));
			const after = await loadContentStructureSnapshot(tx, {
				structureId: structure.id,
				ownerUnitId: input.ownerUnitId,
			});
			const delta = diffContentStructureSnapshots(before, after);
			if (!delta) throw new Error("Changed Realm taxonomy draft produced no revision delta");
			return {
				result: {},
				change: {
					kind: "delta" as const,
					delta,
					checkpoint: () =>
						loadContentStructureSnapshot(tx, {
							structureId: structure.id,
							ownerUnitId: input.ownerUnitId,
						}),
				},
			};
		},
	);
}
