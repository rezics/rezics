"use client";

import { ChevronRight, FileText, Folder, FolderOpen } from "lucide-react";
import { useMemo, useState } from "react";

import {
	Button,
	cn,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
} from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { type BookDraftNode } from "../model/book-content-structure-draft";
import type { MediaDraftNode } from "../model/media-content-structure-draft";

export type ContentStructureDestination =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "inside" | "after";
	  };
export type BookStructureDestination = ContentStructureDestination;
export type ContentStructureDestinationNode = BookDraftNode | MediaDraftNode;
type ContentStructureDestinationTreeNode = {
	readonly node: ContentStructureDestinationNode;
	readonly children: ContentStructureDestinationTreeNode[];
};

type ContentStructureNodeDestination = Extract<
	ContentStructureDestination,
	{ readonly kind: "node" }
>;

export function contentStructureDestinationForNode(
	node: ContentStructureDestinationNode,
): ContentStructureNodeDestination {
	return {
		kind: "node",
		nodeId: node.id,
		placement:
			node.contentKind === "book" || node.contentKind === "media" || node.contentKind === "label"
				? "inside"
				: "after",
	};
}
export const bookStructureDestinationForNode = contentStructureDestinationForNode;

function sameDestination(
	left: ContentStructureDestination | undefined,
	right: ContentStructureDestination,
): boolean {
	if (!left || left.kind !== right.kind) return false;
	if (left.kind === "root" && right.kind === "root") return true;
	return (
		left.kind === "node" &&
		right.kind === "node" &&
		left.nodeId === right.nodeId &&
		left.placement === right.placement
	);
}

function compareNodes(
	left: ContentStructureDestinationNode,
	right: ContentStructureDestinationNode,
): number {
	return left.order - right.order || left.id.localeCompare(right.id);
}

function buildDestinationTree(
	nodes: readonly ContentStructureDestinationNode[],
): readonly ContentStructureDestinationTreeNode[] {
	const knownIds = new Set(nodes.map(({ id }) => id));
	const children = new Map<string | null, ContentStructureDestinationNode[]>();
	for (const node of nodes) {
		const parentId =
			node.parentId && node.parentId !== node.id && knownIds.has(node.parentId)
				? node.parentId
				: null;
		const siblings = children.get(parentId);
		if (siblings) siblings.push(node);
		else children.set(parentId, [node]);
	}
	for (const siblings of children.values()) siblings.sort(compareNodes);
	const seen = new Set<string>();
	const roots: ContentStructureDestinationTreeNode[] = [];
	function appendRoot(node: ContentStructureDestinationNode): void {
		if (seen.has(node.id)) return;
		const root: ContentStructureDestinationTreeNode = { node, children: [] };
		seen.add(node.id);
		roots.push(root);
		const stack = [root];
		while (stack.length) {
			const entry = stack.pop();
			if (!entry) continue;
			const childEntries: ContentStructureDestinationTreeNode[] = [];
			for (const child of children.get(entry.node.id) ?? []) {
				if (seen.has(child.id)) continue;
				seen.add(child.id);
				childEntries.push({ node: child, children: [] });
			}
			entry.children.push(...childEntries);
			for (let index = childEntries.length - 1; index >= 0; index -= 1) {
				const childEntry = childEntries[index];
				if (childEntry) stack.push(childEntry);
			}
		}
	}
	for (const node of children.get(null) ?? []) appendRoot(node);
	for (const node of nodes.toSorted(compareNodes)) appendRoot(node);
	return roots;
}

function flattenVisibleDestinationTree(
	nodes: readonly ContentStructureDestinationTreeNode[],
	expandedIds: ReadonlySet<string>,
): readonly {
	readonly entry: ContentStructureDestinationTreeNode;
	readonly depth: number;
}[] {
	const result: { entry: ContentStructureDestinationTreeNode; depth: number }[] = [];
	const stack = nodes.map((entry) => ({ entry, depth: 1 })).reverse();
	while (stack.length) {
		const item = stack.pop();
		if (!item) continue;
		result.push(item);
		if (!expandedIds.has(item.entry.node.id)) continue;
		for (let index = item.entry.children.length - 1; index >= 0; index -= 1) {
			const child = item.entry.children[index];
			if (child) stack.push({ entry: child, depth: item.depth + 1 });
		}
	}
	return result;
}

export function ContentStructureDestinationDialog({
	description,
	nodes,
	onClose,
	onSelect,
	selectedDestination,
	title,
	validTargetIds,
}: {
	description: string;
	nodes: readonly ContentStructureDestinationNode[];
	onClose: () => void;
	onSelect: (destination: ContentStructureDestination) => void;
	selectedDestination?: ContentStructureDestination;
	title: string;
	validTargetIds?: ReadonlySet<string>;
}) {
	const { t } = useTranslation(["engagement", "units"]);
	const tree = useMemo(() => buildDestinationTree(nodes), [nodes]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
	const visibleEntries = useMemo(
		() => flattenVisibleDestinationTree(tree, expandedIds),
		[expandedIds, tree],
	);

	function toggle(nodeId: string) {
		setExpandedIds((current) => {
			const next = new Set(current);
			if (next.has(nodeId)) next.delete(nodeId);
			else next.add(nodeId);
			return next;
		});
	}

	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent size="lg">
				<DialogHeader description={description} title={title} />
				<DialogBody className="p-0">
					<div className="max-h-[32rem] overflow-y-auto p-3">
						<button
							aria-pressed={sameDestination(selectedDestination, { kind: "root" })}
							className={cn(
								"flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-start text-sm outline-none transition-colors",
								"hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
								sameDestination(selectedDestination, { kind: "root" }) &&
									"bg-accent text-accent-foreground",
							)}
							onClick={() => onSelect({ kind: "root" })}
							type="button"
						>
							<FolderOpen aria-hidden className="size-4 shrink-0" />
							<span className="truncate font-medium">{t.units.content.root}</span>
						</button>
						<ul className="m-0 list-none p-0">
							{visibleEntries.map(({ depth, entry }) => (
								<DestinationTreeRow
									depth={depth}
									entry={entry}
									expandedIds={expandedIds}
									key={entry.node.id}
									onSelect={onSelect}
									onToggle={toggle}
									selectedDestination={selectedDestination}
									validTargetIds={validTargetIds}
								/>
							))}
						</ul>
					</div>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="quiet">
							{t.engagement.cancel}
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
export const BookContentStructureDestinationDialog = ContentStructureDestinationDialog;

function DestinationTreeRow({
	depth,
	entry,
	expandedIds,
	onSelect,
	onToggle,
	selectedDestination,
	validTargetIds,
}: {
	depth: number;
	entry: ContentStructureDestinationTreeNode;
	expandedIds: ReadonlySet<string>;
	onSelect: (destination: ContentStructureDestination) => void;
	onToggle: (nodeId: string) => void;
	selectedDestination?: ContentStructureDestination;
	validTargetIds?: ReadonlySet<string>;
}) {
	const { t } = useTranslation(["units"]);
	const { node, children } = entry;
	const expanded = expandedIds.has(node.id);
	const destination = contentStructureDestinationForNode(node);
	const selected = sameDestination(selectedDestination, destination);
	const selectable = validTargetIds?.has(node.id) ?? true;
	const isLabel = node.contentKind === "label";

	return (
		<li className="m-0 list-none p-0">
			<div
				className="flex min-h-11 items-center gap-1"
				style={{ paddingInlineStart: `${depth * 1.25}rem` }}
			>
				{children.length ? (
					<button
						aria-label={expanded ? t.units.content.collapse : t.units.content.expand}
						className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
						onClick={() => onToggle(node.id)}
						type="button"
					>
						<ChevronRight
							aria-hidden
							className={cn(
								"size-4 transition-transform motion-reduce:transition-none",
								expanded && "rotate-90",
							)}
						/>
					</button>
				) : (
					<span aria-hidden className="size-8 shrink-0" />
				)}
				<button
					aria-pressed={selected}
					className={cn(
						"flex min-h-9 min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-start text-sm outline-none transition-colors",
						"hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
						selected && "bg-accent text-accent-foreground",
						!selectable && "cursor-not-allowed opacity-45",
					)}
					disabled={!selectable}
					onClick={() => onSelect(destination)}
					type="button"
				>
					{isLabel ? (
						expanded ? (
							<FolderOpen aria-hidden className="size-4 shrink-0" />
						) : (
							<Folder aria-hidden className="size-4 shrink-0" />
						)
					) : (
						<FileText aria-hidden className="size-4 shrink-0" />
					)}
					<span className="truncate">{node.title}</span>
				</button>
			</div>
		</li>
	);
}
