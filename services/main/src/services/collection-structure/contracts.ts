import { z } from "zod";

import { isFractionalPosition } from "../ordering/position";

export const CollectionStructureContentModel = "rezics.collection-structure.v1" as const;
export const CollectionStructureCheckpointDepth = 32;
export const CollectionStructureLargeDeltaBytes = 64 * 1024;
export const CollectionStructureReplayBytes = 256 * 1024;

export function shouldCheckpointCollectionStructureRevision(input: {
	readonly currentDeltaDepth: number;
	readonly currentReplayByteSize: number;
	readonly checkpointByteSize: number;
	readonly deltaByteSize: number;
	readonly forceCheckpoint?: boolean;
}): boolean {
	for (const [name, value] of Object.entries(input)) {
		if (name === "forceCheckpoint") continue;
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
			throw new TypeError(`Invalid Collection Structure checkpoint input ${name}`);
	}
	const nextReplayByteSize = input.currentReplayByteSize + input.deltaByteSize;
	if (!Number.isSafeInteger(nextReplayByteSize))
		throw new TypeError("Collection Structure replay byte size exceeds the safe integer range");
	return (
		input.forceCheckpoint === true ||
		input.currentDeltaDepth + 1 >= CollectionStructureCheckpointDepth ||
		input.deltaByteSize >= CollectionStructureLargeDeltaBytes ||
		nextReplayByteSize >= CollectionStructureReplayBytes ||
		nextReplayByteSize >= input.checkpointByteSize
	);
}

const UuidSchema = z.uuid();
const FractionalPositionSchema = z.string().refine(isFractionalPosition);

export const CollectionStructureItemStateSchema = z.object({
	targetUnitId: UuidSchema,
	position: FractionalPositionSchema,
	addedByProfileId: UuidSchema.nullable(),
	addedAt: z.coerce.date(),
});
export type CollectionStructureItemState = z.infer<typeof CollectionStructureItemStateSchema>;

export const CollectionStructureSnapshotSchema = z
	.object({
		version: z.literal(1),
		collectionId: UuidSchema,
		items: z.array(CollectionStructureItemStateSchema),
	})
	.superRefine((snapshot, context) => {
		const ids = new Set(snapshot.items.map((item) => item.targetUnitId));
		if (ids.size !== snapshot.items.length)
			context.addIssue({ code: "custom", message: "Duplicate Collection item target" });
		const positions = new Set<string>();
		for (const item of snapshot.items) {
			if (positions.has(item.position))
				context.addIssue({
					code: "custom",
					message: `Collection item ${item.targetUnitId} has a duplicate position`,
				});
			positions.add(item.position);
		}
	});
export type CollectionStructureSnapshot = z.infer<typeof CollectionStructureSnapshotSchema>;

const ItemInsertOperationSchema = z.object({
	kind: z.literal("item.insert"),
	after: CollectionStructureItemStateSchema,
});
const ItemUpdateOperationSchema = z
	.object({
		kind: z.literal("item.update"),
		before: CollectionStructureItemStateSchema,
		after: CollectionStructureItemStateSchema,
	})
	.refine((operation) => operation.before.targetUnitId === operation.after.targetUnitId, {
		message: "A Collection item update cannot change target identity",
	});
const ItemDeleteOperationSchema = z.object({
	kind: z.literal("item.delete"),
	before: CollectionStructureItemStateSchema,
});

export const CollectionStructureOperationSchema = z.discriminatedUnion("kind", [
	ItemInsertOperationSchema,
	ItemUpdateOperationSchema,
	ItemDeleteOperationSchema,
]);
export type CollectionStructureOperation = z.infer<typeof CollectionStructureOperationSchema>;

export const CollectionStructureDeltaSchema = z.object({
	version: z.literal(1),
	collectionId: UuidSchema,
	operations: z.array(CollectionStructureOperationSchema).min(1),
});
export type CollectionStructureDelta = z.infer<typeof CollectionStructureDeltaSchema>;

function comparable(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		item instanceof Date ? item.toISOString() : item,
	);
}

function compareItems(
	left: CollectionStructureItemState,
	right: CollectionStructureItemState,
): number {
	return left.targetUnitId.localeCompare(right.targetUnitId);
}

export function parseCollectionStructureSnapshot(value: unknown): CollectionStructureSnapshot {
	const snapshot = CollectionStructureSnapshotSchema.parse(value);
	return { ...snapshot, items: [...snapshot.items].sort(compareItems) };
}

export function diffCollectionStructureSnapshots(
	beforeValue: unknown,
	afterValue: unknown,
): CollectionStructureDelta | null {
	const before = parseCollectionStructureSnapshot(beforeValue);
	const after = parseCollectionStructureSnapshot(afterValue);
	if (before.collectionId !== after.collectionId)
		throw new TypeError("Cannot diff different Collection structures");
	const operations: CollectionStructureOperation[] = [];
	const beforeItems = new Map(before.items.map((item) => [item.targetUnitId, item]));
	const afterItems = new Map(after.items.map((item) => [item.targetUnitId, item]));
	for (const item of before.items)
		if (!afterItems.has(item.targetUnitId))
			operations.push({ kind: "item.delete", before: item });
	for (const item of after.items) {
		const previous = beforeItems.get(item.targetUnitId);
		if (!previous) operations.push({ kind: "item.insert", after: item });
		else if (comparable(previous) !== comparable(item))
			operations.push({ kind: "item.update", before: previous, after: item });
	}
	if (!operations.length) return null;
	return CollectionStructureDeltaSchema.parse({
		version: 1,
		collectionId: before.collectionId,
		operations,
	});
}

export function applyCollectionStructureDelta(
	baseValue: unknown,
	deltaValue: unknown,
): CollectionStructureSnapshot {
	const base = parseCollectionStructureSnapshot(baseValue);
	const delta = CollectionStructureDeltaSchema.parse(deltaValue);
	if (base.collectionId !== delta.collectionId)
		throw new TypeError("Collection Structure delta base does not match its Collection");
	const items = new Map(base.items.map((item) => [item.targetUnitId, item]));
	for (const operation of delta.operations) {
		switch (operation.kind) {
			case "item.insert":
				if (items.has(operation.after.targetUnitId))
					throw new TypeError(
						`Collection item ${operation.after.targetUnitId} already exists`,
					);
				items.set(operation.after.targetUnitId, operation.after);
				break;
			case "item.update": {
				const current = items.get(operation.before.targetUnitId);
				if (!current || comparable(current) !== comparable(operation.before))
					throw new TypeError(
						`Collection item ${operation.before.targetUnitId} base changed`,
					);
				items.set(operation.after.targetUnitId, operation.after);
				break;
			}
			case "item.delete": {
				const current = items.get(operation.before.targetUnitId);
				if (!current || comparable(current) !== comparable(operation.before))
					throw new TypeError(
						`Collection item ${operation.before.targetUnitId} base changed`,
					);
				items.delete(operation.before.targetUnitId);
				break;
			}
		}
	}
	return parseCollectionStructureSnapshot({
		version: 1,
		collectionId: delta.collectionId,
		items: [...items.values()],
	});
}
