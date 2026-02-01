import React from 'react';
import type {NodeRendererProps} from 'react-arborist';
import {useTheme, alpha} from '@mui/material/styles';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {Link} from '@package/ui/Navigation/Link.tsx';

// Type used inside the BookEditorSidebar tree
export type Chapter = {
  id: string | number;
  title: string;
  children?: Chapter[];
};

// Context-menu state type reused from the sidebar component
export type ContextMenuState = {
  x: number;
  y: number;
  node: any;
} | null;

/**
 * Factory that returns a Node renderer function bound to the sidebar's state setters.
 * We use a factory instead of props because `react-arborist` expects the renderer
 * signature `({ node, style, dragHandle, tree }) => JSX.Element` only.
 */
export const createChapterArboristNode = (
  setContextMenu: React.Dispatch<React.SetStateAction<ContextMenuState>>,
  treeRef: React.RefObject<any>,
  enableDoubleClickRename: boolean,
  isTreeDraggable: boolean,
  bookId: string,
  isEditable: boolean = false,
) => {
  return function ChapterArboristNode({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<Chapter>) {
    const theme = useTheme();
    const hasChildren = !!(node.children && node.children.length > 0);
    const isSelected = node.state.isSelected;
    const selectedBg = alpha(theme.palette.primary.main, 0.08);
    const selectedColor = theme.palette.primary.main;

    return (
      <div
        style={{
          ...style,
          backgroundColor: isSelected ? selectedBg : 'transparent',
          color: isSelected ? selectedColor : undefined,
        }}
        ref={!node.isEditing && isTreeDraggable ? dragHandle : undefined}
        className={`flex items-center gap-2 px-2 py-1 cursor-pointer select-none rounded-sm transition-colors hover:bg-slate-100 dark:hover:bg-slate-800`}
        onDoubleClick={() => {
          if (enableDoubleClickRename) {
            node.edit();
          }
        }}
        onContextMenu={e => {
          e.preventDefault();
          e.stopPropagation();
          const currentNodeId = String(node.id);
          treeRef.current?.select(currentNodeId);
          setContextMenu({x: e.clientX, y: e.clientY, node});
        }}
      >
        {/* Arrow toggle */}
        {hasChildren ? (
          <button
            type="button"
            onClick={() => node.toggle()}
            className="w-5 h-5 flex justify-center items-center text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            aria-label={node.isOpen ? 'Collapse' : 'Expand'}
          >
            {node.isOpen ? (
              <KeyboardArrowDownIcon fontSize="small" />
            ) : (
              <KeyboardArrowRightIcon fontSize="small" />
            )}
          </button>
        ) : // <span className="w-5 h-5" />
        null}

        {/* Node icon */}
        {/* <span className="w-5 h-5 flex justify-center items-center text-slate-500 dark:text-slate-400">
          {hasChildren ? (
            node.isOpen ? (
              <FolderOpenOutlinedIcon fontSize="small" />
            ) : (
              <FolderOutlinedIcon fontSize="small" />
            )
          ) : (
            <DescriptionOutlinedIcon fontSize="small" />
          )}
        </span> */}

        {/* Title or editing input */}
        <div className="min-w-0 flex-1">
          {node.isEditing ? (
            <input
              type="text"
              defaultValue={node.data.title}
              onFocus={e => e.currentTarget.select()}
              onBlur={() => node.reset()}
              onKeyDown={e => {
                if (e.key === 'Escape') node.reset();
                if (e.key === 'Enter') {
                  node.submit((e.target as HTMLInputElement).value);
                }
              }}
              className="w-full px-2 py-1 text-sm rounded border bg-transparent focus:outline-none"
              style={{
                boxShadow: `0 0 0 2px ${alpha(
                  theme.palette.primary.main,
                  0.25,
                )}`,
              }}
            />
          ) : hasChildren ? (
            <span className="truncate">{node.data.title}</span>
          ) : isEditable ? (
            <span className="block truncate">{node.data.title}</span>
          ) : (
            <Link
              to="/book/$bookId/read/$chapterId"
              params={{bookId: bookId, chapterId: node.id}}
            >
              <span className="block truncate">{node.data.title}</span>
            </Link>
          )}
        </div>

        {/* Visual drag indicator when draggable (drag handle remains row-wide for usability) */}
        {!node.isEditing && isTreeDraggable && (
          <span className="ml-1 w-5 h-5 flex items-center justify-center text-slate-400 hover:text-slate-600">
            <DragIndicatorIcon fontSize="small" />
          </span>
        )}
      </div>
    );
  };
};
