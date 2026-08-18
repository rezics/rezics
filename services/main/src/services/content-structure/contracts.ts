import { z } from "zod";

import {
	ContentRatingValues,
	ContentStructureKindValues,
	ContentStructureTargetKindValues,
	RealmTagQueryStrategyValues,
	type ContentStructureKind,
	type ContentStructureTargetKind,
	type PostKind,
	type UnitKind,
} from "../database/schema/contract-values";
import { FractionalPositionStorageMaximumBytes, isFractionalPosition } from "../ordering/position";

export const ContentStructureContentModel = "rezics.content-structure.v1" as const;
export const ContentStructureCheckpointDepth = 32;
export const ContentStructureLargeDeltaBytes = 64 * 1024;
export const ContentStructureReplayBytes = 256 * 1024;

export function shouldCheckpointContentStructureRevision(input: {
	readonly currentDeltaDepth: number;
	readonly currentReplayByteSize: number;
	readonly checkpointByteSize: number;
	readonly deltaByteSize: number;
	readonly forceCheckpoint?: boolean;
}): boolean {
	for (const [name, value] of Object.entries(input)) {
		if (name === "forceCheckpoint") continue;
		if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0)
			throw new TypeError(`Invalid Content Structure checkpoint input ${name}`);
	}
	const nextReplayByteSize = input.currentReplayByteSize + input.deltaByteSize;
	if (!Number.isSafeInteger(nextReplayByteSize))
		throw new TypeError("Content Structure replay byte size exceeds the safe integer range");
	return (
		input.forceCheckpoint === true ||
		input.currentDeltaDepth + 1 >= ContentStructureCheckpointDepth ||
		input.deltaByteSize >= ContentStructureLargeDeltaBytes ||
		nextReplayByteSize >= ContentStructureReplayBytes ||
		nextReplayByteSize >= input.checkpointByteSize
	);
}

const UuidSchema = z.uuid();
const DateSchema = z.coerce.date();
const FractionalPositionSchema = z
	.string()
	.max(FractionalPositionStorageMaximumBytes)
	.refine(isFractionalPosition);

export const ContentStructureTargetSchema = z.discriminatedUnion("kind", [
	z.object({ kind: z.literal("content") }),
	z.object({ kind: z.literal("none") }),
	z.object({ kind: z.literal("unit"), unitId: UuidSchema }),
	z.object({ kind: z.literal("external"), url: z.url().startsWith("https://").max(2_000) }),
]);
export type ContentStructureTarget = z.infer<typeof ContentStructureTargetSchema>;

export const ContentStructureStateSchema = z
	.object({
		id: UuidSchema,
		ownerUnitId: UuidSchema,
		kind: z.enum(ContentStructureKindValues),
		documentKey: z
			.string()
			.regex(/^[0-9a-f]{12}$/)
			.nullable(),
		deletedAt: DateSchema.nullable(),
		createdAt: DateSchema,
		updatedAt: DateSchema,
	})
	.superRefine((structure, context) => {
		const navigation = structure.kind === "wiki.navigation" || structure.kind === "zone.navigation";
		if (navigation !== (structure.documentKey !== null))
			context.addIssue({
				code: "custom",
				message: "Only navigation structures have a document key",
			});
	});
export type ContentStructureState = z.infer<typeof ContentStructureStateSchema>;

export const ContentStructureNodeStateSchema = z
	.object({
		id: UuidSchema,
		structureId: UuidSchema,
		ownerUnitId: UuidSchema,
		parentId: UuidSchema.nullable(),
		contentUnitId: UuidSchema,
		documentKey: z
			.string()
			.regex(/^[0-9a-f]{12}$/)
			.nullable(),
		targetKind: z.enum(ContentStructureTargetKindValues),
		targetUnitId: UuidSchema.nullable(),
		targetUrl: z.string().nullable(),
		position: FractionalPositionSchema,
		contentRating: z.enum(ContentRatingValues).nullable(),
		realmTagQueryStrategy: z.enum(RealmTagQueryStrategyValues).nullable().default(null),
		deletedAt: DateSchema.nullable(),
		createdAt: DateSchema,
		updatedAt: DateSchema,
	})
	.superRefine((node, context) => {
		const expected =
			node.targetKind === "unit"
				? { unit: true, url: false }
				: node.targetKind === "external"
					? { unit: false, url: true }
					: { unit: false, url: false };
		if (
			(node.targetUnitId !== null) !== expected.unit ||
			(node.targetUrl !== null) !== expected.url
		)
			context.addIssue({ code: "custom", message: "Invalid Content Structure target shape" });
		if (
			node.targetUrl !== null &&
			!ContentStructureTargetSchema.safeParse({
				kind: "external",
				url: node.targetUrl,
			}).success
		)
			context.addIssue({ code: "custom", message: "Invalid external target URL" });
	});
export type ContentStructureNodeState = z.infer<typeof ContentStructureNodeStateSchema>;

export const ContentStructureSnapshotSchema = z
	.object({
		version: z.literal(1),
		structure: ContentStructureStateSchema,
		nodes: z.array(ContentStructureNodeStateSchema),
	})
	.superRefine((snapshot, context) => {
		const ids = new Set(snapshot.nodes.map((node) => node.id));
		if (snapshot.structure.deletedAt !== null)
			context.addIssue({ code: "custom", message: "Checkpoint structure is deleted" });
		if (ids.size !== snapshot.nodes.length)
			context.addIssue({ code: "custom", message: "Duplicate Content Structure node id" });
		const documentKeys = snapshot.nodes
			.map((node) => node.documentKey)
			.filter((key): key is string => key !== null);
		if (new Set(documentKeys).size !== documentKeys.length)
			context.addIssue({ code: "custom", message: "Duplicate navigation document key" });
		for (const node of snapshot.nodes) {
			if (node.deletedAt !== null)
				context.addIssue({
					code: "custom",
					message: `Checkpoint node ${node.id} is deleted`,
				});
			if (
				node.structureId !== snapshot.structure.id ||
				node.ownerUnitId !== snapshot.structure.ownerUnitId
			)
				context.addIssue({
					code: "custom",
					message: `Node ${node.id} is outside the checkpoint structure`,
				});
			if (node.parentId !== null && !ids.has(node.parentId))
				context.addIssue({
					code: "custom",
					message: `Node ${node.id} has a missing parent`,
				});
		}
	});
export type ContentStructureSnapshot = z.infer<typeof ContentStructureSnapshotSchema>;

export const DeletedContentStructureSnapshotSchema = z.object({
	version: z.literal(1),
	deleted: z.literal(true),
	structureId: UuidSchema,
});
export type DeletedContentStructureSnapshot = z.infer<typeof DeletedContentStructureSnapshotSchema>;
export const ContentStructureLogicalStateSchema = z.union([
	ContentStructureSnapshotSchema,
	DeletedContentStructureSnapshotSchema,
]);
export type ContentStructureLogicalState = z.infer<typeof ContentStructureLogicalStateSchema>;

const NodeInsertOperationSchema = z.object({
	kind: z.literal("node.insert"),
	after: ContentStructureNodeStateSchema,
});
const NodeUpdateOperationSchema = z
	.object({
		kind: z.literal("node.update"),
		before: ContentStructureNodeStateSchema,
		after: ContentStructureNodeStateSchema,
	})
	.refine((operation) => operation.before.id === operation.after.id, {
		message: "A node update cannot change node identity",
	});
const NodeDeleteOperationSchema = z.object({
	kind: z.literal("node.delete"),
	before: ContentStructureNodeStateSchema,
});
const StructureUpdateOperationSchema = z
	.object({
		kind: z.literal("structure.update"),
		before: ContentStructureStateSchema,
		after: ContentStructureStateSchema,
	})
	.refine((operation) => operation.before.id === operation.after.id, {
		message: "A structure update cannot change structure identity",
	});
const StructureDeleteOperationSchema = z.object({
	kind: z.literal("structure.delete"),
	before: ContentStructureStateSchema,
});

export const ContentStructureOperationSchema = z.discriminatedUnion("kind", [
	NodeInsertOperationSchema,
	NodeUpdateOperationSchema,
	NodeDeleteOperationSchema,
	StructureUpdateOperationSchema,
	StructureDeleteOperationSchema,
]);
export type ContentStructureOperation = z.infer<typeof ContentStructureOperationSchema>;

export const ContentStructureDeltaSchema = z.object({
	version: z.literal(1),
	structureId: UuidSchema,
	operations: z.array(ContentStructureOperationSchema).min(1),
});
export type ContentStructureDelta = z.infer<typeof ContentStructureDeltaSchema>;

type KindPolicy = {
	readonly ownerKinds: readonly UnitKind[];
	readonly targets: readonly ContentStructureTargetKind[];
	readonly progress: "none" | "node_completion";
	readonly acceptsContent: (kind: UnitKind, postKind: PostKind | null) => boolean;
	readonly contributesProgress: (kind: UnitKind, postKind: PostKind | null) => boolean;
};

const anyContent = () => true;
const noProgress: KindPolicy["contributesProgress"] = () => false;
const timedMediaProgress: KindPolicy["contributesProgress"] = (kind) =>
	kind === "video" || kind === "audio";
const navigationTargets = ["unit", "external", "none"] as const;

/**
 * Defines the owner, content, target, and progress policy for each persisted
 * Content Structure kind.
 *
 * @remarks
 * Book progress is derived only from explicit Chapter occurrences in the
 * current `book.contents` structure. Book and Label occurrences are structural
 * or navigational and never contribute progress themselves. A Chapter nested
 * beneath either one contributes because it is still an explicit occurrence
 * owned by this structure; the referenced Book's structure is never traversed
 * or inherited. Completion is scoped to the occurrence node ID, so one Chapter
 * Unit can participate independently in multiple Books.
 *
 * Media follows the same rule: only explicit Video and Audio occurrences
 * contribute. Media and Label occurrences do not, and referenced Media
 * structures are never traversed.
 */
export const ContentStructureKindPolicies = {
	"book.contents": {
		ownerKinds: ["book"],
		targets: ["content"],
		progress: "node_completion",
		acceptsContent: (kind, postKind) =>
			kind === "book" || kind === "label" || (kind === "post" && postKind === "chapter"),
		contributesProgress: (kind, postKind) => kind === "post" && postKind === "chapter",
	},
	"media.contents": {
		ownerKinds: ["media"],
		targets: ["content"],
		progress: "node_completion",
		acceptsContent: (kind) =>
			kind === "media" || kind === "label" || kind === "video" || kind === "audio",
		contributesProgress: timedMediaProgress,
	},
	"post.contents": {
		ownerKinds: ["post"],
		targets: ["content"],
		progress: "none",
		acceptsContent: anyContent,
		contributesProgress: noProgress,
	},
	"realm.taxonomy": {
		ownerKinds: ["realm"],
		targets: ["content"],
		progress: "none",
		/** TODO(wiki): project wiki Post bodies as long-form taxonomy descriptions. */
		acceptsContent: (kind, postKind) =>
			kind === "label" || kind === "tag" || (kind === "post" && postKind === "wiki"),
		contributesProgress: noProgress,
	},
	"wiki.navigation": {
		ownerKinds: ["realm"],
		targets: ["unit", "none"],
		progress: "none",
		acceptsContent: (kind, postKind) =>
			kind === "label" || (kind === "post" && postKind === "wiki"),
		contributesProgress: noProgress,
	},
	"zone.navigation": {
		ownerKinds: ["zone"],
		targets: navigationTargets,
		progress: "none",
		acceptsContent: anyContent,
		contributesProgress: noProgress,
	},
	/**
	 * Optional visual index for Zone Page Units. A Page remains valid and
	 * addressable when it is not present in this structure.
	 */
	"page-structure": {
		ownerKinds: ["zone"],
		targets: ["content"],
		progress: "none",
		acceptsContent: (kind) => kind === "zone_page",
		contributesProgress: noProgress,
	},
} as const satisfies Record<ContentStructureKind, KindPolicy>;

function comparable(value: unknown): string {
	return JSON.stringify(value, (_key, item: unknown) =>
		item instanceof Date ? item.toISOString() : item,
	);
}

export function diffContentStructureSnapshots(
	before: ContentStructureSnapshot,
	after: ContentStructureSnapshot | null,
): ContentStructureDelta | null {
	if (after !== null && before.structure.id !== after.structure.id)
		throw new TypeError("Cannot diff different Content Structures");
	const operations: ContentStructureOperation[] = [];
	const beforeNodes = new Map(before.nodes.map((node) => [node.id, node]));
	const afterNodes = new Map((after?.nodes ?? []).map((node) => [node.id, node]));
	for (const node of before.nodes)
		if (!afterNodes.has(node.id)) operations.push({ kind: "node.delete", before: node });
	for (const node of after?.nodes ?? []) {
		const previous = beforeNodes.get(node.id);
		if (!previous) operations.push({ kind: "node.insert", after: node });
		else if (comparable(previous) !== comparable(node))
			operations.push({ kind: "node.update", before: previous, after: node });
	}
	if (after === null) operations.push({ kind: "structure.delete", before: before.structure });
	else if (comparable(before.structure) !== comparable(after.structure))
		operations.push({
			kind: "structure.update",
			before: before.structure,
			after: after.structure,
		});
	if (operations.length === 0) return null;
	return ContentStructureDeltaSchema.parse({
		version: 1,
		structureId: before.structure.id,
		operations,
	});
}

export function applyContentStructureDelta(
	baseValue: unknown,
	deltaValue: unknown,
): ContentStructureLogicalState {
	const base = ContentStructureSnapshotSchema.parse(baseValue);
	const delta = ContentStructureDeltaSchema.parse(deltaValue);
	if (base.structure.id !== delta.structureId)
		throw new TypeError("Content Structure delta base does not match its structure");
	let structure = base.structure;
	const nodes = new Map(base.nodes.map((node) => [node.id, node]));
	let deleted = false;
	for (const operation of delta.operations) {
		switch (operation.kind) {
			case "node.insert":
				if (nodes.has(operation.after.id))
					throw new TypeError(`Content Structure node ${operation.after.id} already exists`);
				nodes.set(operation.after.id, operation.after);
				break;
			case "node.update": {
				const current = nodes.get(operation.before.id);
				if (!current || comparable(current) !== comparable(operation.before))
					throw new TypeError(`Content Structure node ${operation.before.id} base changed`);
				nodes.set(operation.after.id, operation.after);
				break;
			}
			case "node.delete": {
				const current = nodes.get(operation.before.id);
				if (!current || comparable(current) !== comparable(operation.before))
					throw new TypeError(`Content Structure node ${operation.before.id} base changed`);
				nodes.delete(operation.before.id);
				break;
			}
			case "structure.update":
				if (comparable(structure) !== comparable(operation.before))
					throw new TypeError("Content Structure base changed");
				structure = operation.after;
				break;
			case "structure.delete":
				if (comparable(structure) !== comparable(operation.before) || nodes.size)
					throw new TypeError("Content Structure deletion base changed");
				deleted = true;
				break;
		}
	}
	if (deleted) return { version: 1, deleted: true, structureId: delta.structureId };
	return ContentStructureSnapshotSchema.parse({
		version: 1,
		structure,
		nodes: [...nodes.values()],
	});
}
