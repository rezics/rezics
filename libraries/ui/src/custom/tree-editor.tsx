"use client";

import type { TreeCollection } from "@ark-ui/react/collection";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../utils";
import { TreeView, TreeViewLabel, TreeViewTree, type TreeNodeType } from "../ui/tree-view";

export interface TreeEditorProps<T extends TreeNodeType>
	extends Pick<
		ComponentProps<typeof TreeView>,
		"expandOnClick" | "onSelectionChange" | "selectedValue" | "selectionMode"
	> {
	collection: TreeCollection<T>;
	label: string;
	renderNode: (node: T, indexPath: number[]) => ReactNode;
	className?: string;
	defaultExpandedValue?: string[];
}

/**
 * Shared, domain-neutral editing surface for hierarchical content. Ark UI owns
 * the WAI-ARIA tree keyboard model; feature code owns mutations and actions.
 */
export function TreeEditor<T extends TreeNodeType>({
	collection,
	label,
	renderNode,
	className,
	defaultExpandedValue,
	expandOnClick,
	onSelectionChange,
	selectedValue,
	selectionMode,
}: TreeEditorProps<T>) {
	return (
		<TreeView
			className={cn(
				"[--indentation:--spacing(3)] overflow-hidden rounded-lg border border-border-weak",
				className,
			)}
			collection={collection}
			defaultExpandedValue={defaultExpandedValue}
			expandOnClick={expandOnClick}
			onSelectionChange={onSelectionChange}
			selectedValue={selectedValue}
			selectionMode={selectionMode}
		>
			<TreeViewLabel className="sr-only">{label}</TreeViewLabel>
			<TreeViewTree>
				{collection
					.getNodeChildren(collection.rootNode)
					.map((node, index) => renderNode(node, [index]))}
			</TreeViewTree>
		</TreeView>
	);
}
