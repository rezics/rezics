import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from "@rezics/ui/shadcn/dropdown-menu.tsx";
import { v4 as uuidv4 } from "uuid";
import {
  insertSiblingAfter,
  moveSiblingFirst,
  moveSiblingLast,
} from "@/shared/util/arborist-tree";
import type { Chapter, ChapterContextMenuState } from "./ChapterTreeEditor";

interface ChapterTreeContextMenuProps {
  contextMenu: NonNullable<ChapterContextMenuState>;
  setContextMenu: (state: ChapterContextMenuState) => void;
  setTreeData: React.Dispatch<React.SetStateAction<Chapter[]>>;
  handleCreate: (parentId: string | number) => void;
}

export const ChapterTreeContextMenu = ({
  contextMenu,
  setContextMenu,
  setTreeData,
  handleCreate,
}: ChapterTreeContextMenuProps) => {
  const { node } = contextMenu;

  const close = () => setContextMenu(null);

  return (
    <DropdownMenu
      open={true}
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DropdownMenuContent
        className="min-w-[180px]"
        style={{
          position: "fixed",
          top: contextMenu.y,
          left: contextMenu.x,
        }}
      >
        <DropdownMenuItem
          onSelect={() => {
            node.edit();
            close();
          }}
        >
          Rename
          <DropdownMenuShortcut>F2</DropdownMenuShortcut>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            handleCreate(node.id);
            close();
          }}
        >
          New Child Chapter
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
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
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onSelect={() => {
            if (node.children && node.children.length > 0) {
              node.toggle();
            }
            close();
          }}
        >
          {node.isOpen ? "Collapse" : "Expand"}
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            setTreeData(
              (current) => moveSiblingFirst(current, node.id) as Chapter[],
            );
            close();
          }}
        >
          Move to First
        </DropdownMenuItem>

        <DropdownMenuItem
          onSelect={() => {
            setTreeData(
              (current) => moveSiblingLast(current, node.id) as Chapter[],
            );
            close();
          }}
        >
          Move to Last
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={() => {
            node.tree.delete(node.id);
            close();
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
