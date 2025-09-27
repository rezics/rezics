import React from "react";
import { NodeRendererProps } from "react-arborist";
import { Link } from "wouter";

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
  baseLink: string,
) => {
  return function ChapterArboristNode({
    node,
    style,
    dragHandle,
  }: NodeRendererProps<Chapter>) {
    return (
      <div
        style={style}
        ref={!node.isEditing && isTreeDraggable ? dragHandle : undefined}
        className={`flex items-center gap-1 px-1 cursor-pointer select-none ${
          node.state.isSelected ? "text-blue-600" : ""
        }`}
        onDoubleClick={() => {
          if (enableDoubleClickRename) {
            node.edit();
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const currentNodeId = String(node.id);
          treeRef.current?.select(currentNodeId);
          setContextMenu({ x: e.clientX, y: e.clientY, node });
        }}
      >
        {/* Arrow toggle */}
        {node.children && node.children.length > 0 && (
          <span
            onClick={() => node.toggle()}
            className="w-4 flex justify-center items-center"
          >
            {node.isOpen ? "▼" : "▶"}
          </span>
        )}

        {/* Icon */}
        {
          /* <span className="w-4 flex justify-center items-center">
                    {node.isLeaf ? "📄" : "📁"}
                </span> */
        }

        {/* Title or editing input */}
        {/* <span className="flex-1 whitespace-nowrap"> */}
        <span className="whitespace-nowrap">
          {node.isEditing
            ? (
              <input
                type="text"
                defaultValue={node.data.title}
                onFocus={(e) => e.currentTarget.select()}
                onBlur={() => node.reset()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") node.reset();
                  if (e.key === "Enter") {
                    node.submit(
                      (e.target as HTMLInputElement).value,
                    );
                  }
                }}
                autoFocus
                className="border px-1 text-sm w-full"
              />
            )
            : node.children && node.children.length > 0
            ? <span>{node.data.title}</span>
            : (
              <Link
                to={`${baseLink}/${node.id}`}
                className="text-gray-700 hover:text-blue-500 block cursor-default hover:cursor-pointer"
              >
                <span
                  className={`${node.isSelected ? "text-red-600" : ""}`}
                >
                  {node.data.title}
                </span>
              </Link>
            )}
        </span>

        {/* Optional quick actions (edit icon) */}
        {
          /* {!node.isEditing && (
                    <button
                        className="ml-1 text-xs opacity-50 hover:opacity-100"
                        onClick={(e) => {
                            e.stopPropagation();
                            node.edit();
                        }}
                    >
                        ✏️
                    </button>
                )} */
        }
      </div>
    );
  };
};
