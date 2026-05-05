import {
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
} from "@rezics/ui/shadcn";
import {
  Network as AccountTree,
  ChevronRight,
  ChevronDown as ExpandMore,
  Search,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { Chapter } from "./ChapterTreeEditor";

interface MoveToParentDialogProps {
  open: boolean;
  onClose: () => void;
  treeData: Chapter[];
  /** The node being moved — excluded from the selectable tree along with its descendants. */
  movingNode: Chapter | null;
  onConfirm: (targetParentId: string | number | null) => void;
}

/** Collect all descendant IDs of a node (including itself). */
function collectIds(node: Chapter): Set<string> {
  const ids = new Set<string>([String(node.id)]);
  if (node.children) {
    for (const child of node.children) {
      for (const id of collectIds(child)) ids.add(id);
    }
  }
  return ids;
}

/** Filter tree: remove excluded nodes and optionally filter by search query. */
function filterTree(
  nodes: Chapter[],
  excludeIds: Set<string>,
  query: string,
): Chapter[] {
  const result: Chapter[] = [];
  for (const node of nodes) {
    if (excludeIds.has(String(node.id))) continue;
    const filteredChildren = node.children
      ? filterTree(node.children, excludeIds, query)
      : undefined;
    const matchesSelf = query
      ? node.title.toLowerCase().includes(query.toLowerCase())
      : true;
    const hasMatchingChildren = filteredChildren && filteredChildren.length > 0;
    if (matchesSelf || hasMatchingChildren) {
      result.push({
        ...node,
        children: filteredChildren,
      });
    }
  }
  return result;
}

function TreeNode({
  node,
  depth,
  selectedId,
  onSelect,
}: {
  node: Chapter;
  depth: number;
  selectedId: string | number | null;
  onSelect: (id: string | number) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = !!(node.children && node.children.length > 0);
  const isSelected =
    selectedId !== null && String(selectedId) === String(node.id);

  return (
    <div>
      {/* biome-ignore lint/a11y/useSemanticElements: this row is keyboard-accessible and contains a nested expand button. */}
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(node.id);
        }}
        className={`flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-md transition-colors ${
          isSelected ? "bg-primary/10 text-primary" : "hover:bg-muted/60"
        }`}
        style={{ paddingLeft: depth * 20 + 8 }}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setExpanded((v) => !v);
            }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center text-muted-foreground"
          >
            {expanded ? (
              <ExpandMore className="w-[18px] h-[18px]" />
            ) : (
              <ChevronRight className="w-[18px] h-[18px]" />
            )}
          </button>
        ) : (
          <span className="w-6" />
        )}
        <AccountTree
          className={`w-4 h-4 ${isSelected ? "text-primary" : "text-muted-foreground"}`}
        />
        <span className={`text-sm truncate ${isSelected ? "font-medium" : ""}`}>
          {node.title}
        </span>
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function MoveToParentDialog({
  open,
  onClose,
  treeData,
  movingNode,
  onConfirm,
}: MoveToParentDialogProps) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | number | null>(null);

  const excludeIds = useMemo(
    () => (movingNode ? collectIds(movingNode) : new Set<string>()),
    [movingNode],
  );

  const filteredTree = useMemo(
    () => filterTree(treeData, excludeIds, search.trim()),
    [treeData, excludeIds, search],
  );

  const handleConfirm = useCallback(() => {
    onConfirm(selectedId);
    onClose();
  }, [selectedId, onConfirm, onClose]);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xs">
        <DialogHeader>
          <DialogTitle>
            {t("book.chapter.move_dialog.title", "Move to...")}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3 min-h-[320px]">
          {movingNode && (
            <p className="text-sm text-text-secondary mb-1">
              {t("book.chapter.move_dialog.moving", "Moving:")}{" "}
              <strong>{movingNode.title}</strong>
            </p>
          )}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-[18px] h-[18px] text-text-tertiary" />
            <Input
              placeholder={t(
                "book.chapter.move_dialog.search_placeholder",
                "Search nodes...",
              )}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              autoFocus
              className="pl-8"
            />
          </div>
          <div
            className="flex-1 overflow-y-auto -mx-1"
            style={{ maxHeight: 320 }}
          >
            {filteredTree.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-12">
                {t("book.chapter.move_dialog.no_results", "No matching nodes")}
              </div>
            ) : (
              filteredTree.map((node) => (
                <TreeNode
                  key={node.id}
                  node={node}
                  depth={0}
                  selectedId={selectedId}
                  onSelect={setSelectedId}
                />
              ))
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button onClick={handleConfirm} disabled={selectedId === null}>
            {t("common.ok", "OK")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
