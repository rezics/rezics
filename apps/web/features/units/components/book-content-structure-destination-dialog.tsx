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
import {
	buildBookDraftTree,
	type BookDraftNode,
	type BookDraftTreeNode,
} from "../model/book-content-structure-draft";

export type BookStructureDestination =
	| { readonly kind: "root" }
	| {
			readonly kind: "node";
			readonly nodeId: string;
			readonly placement: "inside" | "after";
	  };

type BookStructureNodeDestination = Extract<BookStructureDestination, { readonly kind: "node" }>;

export function bookStructureDestinationForNode(node: BookDraftNode): BookStructureNodeDestination {
	return {
		kind: "node",
		nodeId: node.id,
		placement: node.contentKind === "chapter_group" ? "inside" : "after",
	};
}

function sameDestination(
	left: BookStructureDestination | undefined,
	right: BookStructureDestination,
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

function collectExpandableIds(nodes: readonly BookDraftTreeNode[]): string[] {
	return nodes.flatMap(({ node, children }) =>
		children.length
			? [node.id, ...collectExpandableIds(children)]
			: collectExpandableIds(children),
	);
}

export function BookContentStructureDestinationDialog({
	description,
	nodes,
	onClose,
	onSelect,
	selectedDestination,
	title,
	validTargetIds,
}: {
	description: string;
	nodes: readonly BookDraftNode[];
	onClose: () => void;
	onSelect: (destination: BookStructureDestination) => void;
	selectedDestination?: BookStructureDestination;
	title: string;
	validTargetIds?: ReadonlySet<string>;
}) {
	const { t } = useTranslation(["engagement", "units"]);
	const tree = useMemo(() => buildBookDraftTree(nodes), [nodes]);
	const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(
		() => new Set(collectExpandableIds(tree)),
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
							{tree.map((entry) => (
								<DestinationTreeRow
									depth={1}
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
	entry: BookDraftTreeNode;
	expandedIds: ReadonlySet<string>;
	onSelect: (destination: BookStructureDestination) => void;
	onToggle: (nodeId: string) => void;
	selectedDestination?: BookStructureDestination;
	validTargetIds?: ReadonlySet<string>;
}) {
	const { t } = useTranslation(["units"]);
	const { node, children } = entry;
	const expanded = expandedIds.has(node.id);
	const destination = bookStructureDestinationForNode(node);
	const selected = sameDestination(selectedDestination, destination);
	const selectable = validTargetIds?.has(node.id) ?? true;
	const isLabel = node.contentKind === "chapter_group";

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
			{expanded && children.length ? (
				<ul className="m-0 list-none p-0">
					{children.map((child) => (
						<DestinationTreeRow
							depth={depth + 1}
							entry={child}
							expandedIds={expandedIds}
							key={child.node.id}
							onSelect={onSelect}
							onToggle={onToggle}
							selectedDestination={selectedDestination}
							validTargetIds={validTargetIds}
						/>
					))}
				</ul>
			) : null}
		</li>
	);
}
