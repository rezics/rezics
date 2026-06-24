import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { ChevronRight, ListTree } from "lucide-react";
import type React from "react";
import {
  collectDescendantIds,
  type NestedTreeNode,
} from "../models/treeOperations";

interface TreeMoveToDialogProps<TNode extends NestedTreeNode> {
  open: boolean;
  title?: string;
  nodes: TNode[];
  movingNode: TNode | null;
  movingNodes?: readonly TNode[];
  getLabel: (node: TNode) => string;
  onClose: () => void;
  onConfirm: (targetParentId: string | number | null) => void;
}

export function TreeMoveToDialog<TNode extends NestedTreeNode>({
  open,
  title = "Move to...",
  nodes,
  movingNode,
  movingNodes,
  getLabel,
  onClose,
  onConfirm,
}: TreeMoveToDialogProps<TNode>) {
  const blocked = new Set<string>();
  for (const node of movingNodes ?? (movingNode ? [movingNode] : [])) {
    blocked.add(String(node.id));
    for (const id of collectDescendantIds(node)) {
      blocked.add(id);
    }
  }

  const renderNode = (node: TNode, depth: number): React.ReactNode => {
    const disabled = blocked.has(String(node.id));
    return (
      <div key={String(node.id)}>
        <Button
          type="button"
          variant="ghost"
          className="h-auto w-full justify-start px-2 py-2 text-left"
          disabled={disabled}
          onClick={() => {
            onConfirm(node.id);
            onClose();
          }}
        >
          <span style={{ width: `${depth * 1.25}rem` }} aria-hidden />
          <ChevronRight
            className="mr-2 size-4 text-text-tertiary"
            aria-hidden
          />
          <span className="truncate">{getLabel(node)}</span>
        </Button>
        {node.children?.map((child) => renderNode(child as TNode, depth + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[55dvh] overflow-auto rounded-md bg-surface-subtle p-2">
          <Button
            type="button"
            variant="ghost"
            className="h-auto w-full justify-start px-2 py-2 text-left"
            onClick={() => {
              onConfirm(null);
              onClose();
            }}
          >
            <ListTree className="mr-2 size-4 text-text-tertiary" aria-hidden />
            Root
          </Button>
          {nodes.map((node) => renderNode(node, 0))}
        </div>
        <DialogFooter>
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
