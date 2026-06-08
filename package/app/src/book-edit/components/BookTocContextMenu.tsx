import {
  Network as AccountTree,
  Copy as ContentCopy,
  Trash2 as Delete,
  Pencil as Edit,
  ChevronDown as KeyboardArrowDown,
  ChevronUp as KeyboardArrowUp,
  FilePlus as PostAdd,
  ChevronsDownUp as UnfoldLess,
  ChevronsUpDown as UnfoldMore,
} from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
import { v4 as uuidv4 } from "uuid";
import {
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast,
} from "@/shared/utils/arborist-tree";
import type { Chapter, ChapterContextMenuState } from "./BookTocEditor";

interface BookTocContextMenuProps {
  contextMenu: NonNullable<ChapterContextMenuState>;
  setContextMenu: (state: ChapterContextMenuState) => void;
  setTreeData: React.Dispatch<React.SetStateAction<Chapter[]>>;
  handleCreate: (parentId: string | number) => void;
  onEditChapter: (chapter: Chapter) => void;
  onMoveToParent: (chapter: Chapter) => void;
}

interface MenuItemProps {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
  destructive?: boolean;
}

export const BookTocContextMenu = ({
  contextMenu,
  setContextMenu,
  setTreeData,
  handleCreate,
  onEditChapter,
  onMoveToParent,
}: BookTocContextMenuProps) => {
  const { node } = contextMenu;
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setContextMenu(null), [setContextMenu]);

  useEffect(() => {
    const handleClickAway = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        close();
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("mousedown", handleClickAway);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickAway);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [close]);

  return (
    <div
      ref={ref}
      role="menu"
      className="fixed z-50 min-w-[200px] rounded-md border border-border-defined bg-surface-elevated shadow-lg p-1"
      style={{ top: contextMenu.y, left: contextMenu.x }}
    >
      <MenuItem
        icon={<Edit className="w-4 h-4" />}
        onClick={() => {
          onEditChapter(node.data);
          close();
        }}
      >
        Edit
      </MenuItem>

      <MenuItem
        icon={<AccountTree className="w-4 h-4" />}
        onClick={() => {
          onMoveToParent(node.data);
          close();
        }}
      >
        Move to...
      </MenuItem>

      <div className="my-1 h-px bg-border-whisper" />

      <MenuItem
        icon={<PostAdd className="w-4 h-4" />}
        onClick={() => {
          handleCreate(node.id);
          close();
        }}
      >
        New Child Chapter
      </MenuItem>

      <MenuItem
        icon={<ContentCopy className="w-4 h-4" />}
        onClick={() => {
          const newNode: Chapter = {
            id: uuidv4(),
            title: "New Chapter",
          };
          setTreeData(
            (current) =>
              insertSiblingAfter(current, node.id, newNode) as Chapter[],
          );
          close();
        }}
      >
        New Sibling After
      </MenuItem>

      <div className="my-1 h-px bg-border-whisper" />

      <MenuItem
        icon={
          node.isOpen ? (
            <UnfoldLess className="w-4 h-4" />
          ) : (
            <UnfoldMore className="w-4 h-4" />
          )
        }
        onClick={() => {
          if (node.children && node.children.length > 0) {
            node.toggle();
          }
          close();
        }}
      >
        {node.isOpen ? "Collapse" : "Expand"}
      </MenuItem>

      <MenuItem
        icon={<KeyboardArrowUp className="w-4 h-4" />}
        onClick={() => {
          setTreeData(
            (current) => moveSiblingFirst(current, node.id) as Chapter[],
          );
          close();
        }}
      >
        Move to First
      </MenuItem>

      <MenuItem
        icon={<KeyboardArrowDown className="w-4 h-4" />}
        onClick={() => {
          setTreeData(
            (current) => moveSiblingLast(current, node.id) as Chapter[],
          );
          close();
        }}
      >
        Move to Last
      </MenuItem>

      <div className="my-1 h-px bg-border-whisper" />

      <MenuItem
        destructive
        icon={<Delete className="w-4 h-4" />}
        onClick={() => {
          node.tree.delete(node.id);
          close();
        }}
      >
        Delete
      </MenuItem>
    </div>
  );
};

function MenuItem({ onClick, icon, children, destructive }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2 text-sm text-left rounded-sm hover:bg-accent transition-colors ${
        destructive ? "text-error-text" : ""
      }`}
    >
      <span className="flex-shrink-0 w-4 h-4 flex items-center justify-center">
        {icon}
      </span>
      <span className="flex-1">{children}</span>
    </button>
  );
}
