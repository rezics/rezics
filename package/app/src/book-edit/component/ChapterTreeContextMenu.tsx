import {
  AccountTree,
  ContentCopy,
  Delete,
  Edit,
  KeyboardArrowDown,
  KeyboardArrowUp,
  PostAdd,
  UnfoldLess,
  UnfoldMore,
} from "@mui/icons-material";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Typography,
} from "@mui/material";
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
  onEditChapter: (chapter: Chapter) => void;
  onMoveToParent: (chapter: Chapter) => void;
}

export const ChapterTreeContextMenu = ({
  contextMenu,
  setContextMenu,
  setTreeData,
  handleCreate,
  onEditChapter,
  onMoveToParent,
}: ChapterTreeContextMenuProps) => {
  const { node } = contextMenu;

  const close = () => setContextMenu(null);

  return (
    <Menu
      open
      onClose={close}
      anchorReference="anchorPosition"
      anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
      slotProps={{
        paper: {
          sx: { minWidth: 200 },
        },
      }}
    >
      <MenuItem
        onClick={() => {
          onEditChapter(node.data);
          close();
        }}
      >
        <ListItemIcon>
          <Edit fontSize="small" />
        </ListItemIcon>
        <ListItemText>Edit</ListItemText>
      </MenuItem>

      <MenuItem
        onClick={() => {
          onMoveToParent(node.data);
          close();
        }}
      >
        <ListItemIcon>
          <AccountTree fontSize="small" />
        </ListItemIcon>
        <ListItemText>Move to...</ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={() => {
          handleCreate(node.id);
          close();
        }}
      >
        <ListItemIcon>
          <PostAdd fontSize="small" />
        </ListItemIcon>
        <ListItemText>New Child Chapter</ListItemText>
      </MenuItem>

      <MenuItem
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
        <ListItemIcon>
          <ContentCopy fontSize="small" />
        </ListItemIcon>
        <ListItemText>New Sibling After</ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={() => {
          if (node.children && node.children.length > 0) {
            node.toggle();
          }
          close();
        }}
      >
        <ListItemIcon>
          {node.isOpen ? (
            <UnfoldLess fontSize="small" />
          ) : (
            <UnfoldMore fontSize="small" />
          )}
        </ListItemIcon>
        <ListItemText>{node.isOpen ? "Collapse" : "Expand"}</ListItemText>
      </MenuItem>

      <MenuItem
        onClick={() => {
          setTreeData(
            (current) => moveSiblingFirst(current, node.id) as Chapter[],
          );
          close();
        }}
      >
        <ListItemIcon>
          <KeyboardArrowUp fontSize="small" />
        </ListItemIcon>
        <ListItemText>Move to First</ListItemText>
      </MenuItem>

      <MenuItem
        onClick={() => {
          setTreeData(
            (current) => moveSiblingLast(current, node.id) as Chapter[],
          );
          close();
        }}
      >
        <ListItemIcon>
          <KeyboardArrowDown fontSize="small" />
        </ListItemIcon>
        <ListItemText>Move to Last</ListItemText>
      </MenuItem>

      <Divider />

      <MenuItem
        onClick={() => {
          node.tree.delete(node.id);
          close();
        }}
      >
        <ListItemIcon>
          <Delete fontSize="small" color="error" />
        </ListItemIcon>
        <ListItemText>
          <Typography color="error">Delete</Typography>
        </ListItemText>
      </MenuItem>
    </Menu>
  );
};
