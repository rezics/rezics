import {
  AccountTree,
  ExpandMore,
  ChevronRight,
  Search,
} from "@mui/icons-material";
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  TextField,
  Typography,
} from "@mui/material";
import { useCallback, useMemo, useState } from "react";
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
  const isSelected = selectedId !== null && String(selectedId) === String(node.id);

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={() => onSelect(node.id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onSelect(node.id);
        }}
        className={`flex items-center gap-1 py-1.5 px-2 cursor-pointer rounded-md transition-colors ${
          isSelected
            ? "bg-primary/10 text-primary"
            : "hover:bg-muted/60"
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
            className="flex-shrink-0 w-5 h-5 flex items-center justify-center text-muted-foreground"
          >
            {expanded ? (
              <ExpandMore sx={{ fontSize: 18 }} />
            ) : (
              <ChevronRight sx={{ fontSize: 18 }} />
            )}
          </button>
        ) : (
          <span className="w-5" />
        )}
        <AccountTree
          sx={{ fontSize: 16 }}
          className={isSelected ? "text-primary" : "text-muted-foreground"}
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
  const handleEnter = useCallback(() => {
    setSearch("");
    setSelectedId(null);
  }, []);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullWidth
      maxWidth="xs"
      TransitionProps={{ onEnter: handleEnter }}
    >
      <DialogTitle>
        {t("book.chapter.move_dialog.title", "Move to...")}
      </DialogTitle>
      <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 1.5, pt: "8px !important", minHeight: 320 }}>
        {movingNode && (
          <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
            {t("book.chapter.move_dialog.moving", "Moving:")} <strong>{movingNode.title}</strong>
          </Typography>
        )}
        <TextField
          size="small"
          variant="outlined"
          placeholder={t("book.chapter.move_dialog.search_placeholder", "Search nodes...")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search sx={{ fontSize: 18 }} />
              </InputAdornment>
            ),
          }}
        />
        <div className="flex-1 overflow-y-auto -mx-1" style={{ maxHeight: 320 }}>
          {filteredTree.length === 0 ? (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm py-8">
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
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>{t("common.cancel", "Cancel")}</Button>
        <Button
          variant="contained"
          onClick={handleConfirm}
          disabled={selectedId === null}
        >
          {t("common.ok", "OK")}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
