"use client";

import {
	Button,
	createTreeCollection,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogFooter,
	DialogHeader,
	TreeEditor,
	TreeViewBranch,
	TreeViewBranchContent,
	TreeViewBranchItem,
	TreeViewContent,
	TreeViewItem,
	TreeViewNode,
	type TreeNodeType,
} from "@rezics/ui";
import { Folder, House } from "lucide-react";
import { useMemo, useState } from "react";

import { useTranslation } from "@/i18n/client";
import {
	buildBookDraftTree,
	getBookDraftMoveTargetIds,
	type BookDraftNode,
	type BookDraftTreeNode,
} from "../model/book-content-structure-draft";

type MoveTreeNode = Omit<TreeNodeType, "children"> & {
	readonly children?: MoveTreeNode[];
};

function toMoveTreeNodes(nodes: readonly BookDraftTreeNode[]): MoveTreeNode[] {
	return nodes.map(({ node, children }) => ({
		id: node.id,
		name: node.title,
		...(children.length ? { children: toMoveTreeNodes(children) } : {}),
	}));
}

function MoveTreeRow({ node, indexPath }: { node: MoveTreeNode; indexPath: number[] }) {
	return (
		<TreeViewNode indexPath={indexPath} node={node}>
			{node.children?.length ? (
				<TreeViewBranch>
					<TreeViewBranchItem expandedIcon={Folder} icon={Folder}>
						{node.name}
					</TreeViewBranchItem>
					<TreeViewBranchContent>
						{node.children.map((child, index) => (
							<MoveTreeRow
								indexPath={[...indexPath, index]}
								key={child.id}
								node={child}
							/>
						))}
					</TreeViewBranchContent>
				</TreeViewBranch>
			) : (
				<TreeViewContent>
					<TreeViewItem icon={Folder}>{node.name}</TreeViewItem>
				</TreeViewContent>
			)}
		</TreeViewNode>
	);
}

export function BookContentStructureMoveDialog({
	nodes,
	selectedIds,
	onClose,
	onMove,
}: {
	nodes: readonly BookDraftNode[];
	selectedIds: ReadonlySet<string>;
	onClose: () => void;
	onMove: (parentId: string | null) => void;
}) {
	const { t } = useTranslation(["engagement", "units"]);
	const [destinationId, setDestinationId] = useState<string | null>(null);
	const validIds = useMemo(
		() => getBookDraftMoveTargetIds(nodes, selectedIds),
		[nodes, selectedIds],
	);
	const treeNodes = useMemo(
		() => toMoveTreeNodes(buildBookDraftTree(nodes.filter(({ id }) => validIds.has(id)))),
		[nodes, validIds],
	);
	const collection = createTreeCollection<MoveTreeNode>({
		rootNode: { id: "move-dialog-root", name: "", children: treeNodes },
	});

	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent size="lg">
				<DialogHeader
					description={t.units.content.moveDescription}
					title={t.units.content.moveDestination}
				/>
				<DialogBody className="grid gap-3">
					<Button
						aria-pressed={destinationId === null}
						className="w-full justify-start aria-pressed:border-primary aria-pressed:bg-accent"
						onClick={() => setDestinationId(null)}
						type="button"
						variant="outline"
					>
						<House aria-hidden className="size-4" />
						{t.units.content.root}
					</Button>
					{treeNodes.length ? (
						<TreeEditor
							collection={collection}
							defaultExpandedValue={treeNodes.flatMap(
								function expanded(node): string[] {
									return node.children?.length
										? [node.id, ...node.children.flatMap(expanded)]
										: [];
								},
							)}
							label={t.units.content.moveDestination}
							onSelectionChange={({ selectedValue }) =>
								setDestinationId(selectedValue[0] ?? null)
							}
							renderNode={(node, indexPath) => (
								<MoveTreeRow indexPath={indexPath} key={node.id} node={node} />
							)}
							selectedValue={destinationId ? [destinationId] : []}
							selectionMode="single"
						/>
					) : null}
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="quiet">
							{t.engagement.cancel}
						</Button>
					</DialogClose>
					<Button
						onClick={() => {
							onMove(destinationId);
							onClose();
						}}
						type="button"
						variant="solid"
					>
						{t.units.content.move}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
