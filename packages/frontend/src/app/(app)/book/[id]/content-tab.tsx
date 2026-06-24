"use client";

import { bookContentStructureQuery } from "@/atoms/books";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import { ChevronRightIcon, FileTextIcon, FolderIcon } from "lucide-react";
import { use, useMemo } from "react";

import type { ContentStructureNodeDTO } from "@rezics/backend/api";

interface TreeNode extends ContentStructureNodeDTO {
  readonly children: TreeNode[];
  readonly depth: number;
}

// Build a tree from flat node list, sorted by position within each level
// 从扁平节点列表构建树，每层按 position 排序
function buildTree(nodes: readonly ContentStructureNodeDTO[]): TreeNode[] {
  const byParent = new Map<string | null, ContentStructureNodeDTO[]>();
  for (const node of nodes) {
    const list = byParent.get(node.parentId) ?? [];
    list.push(node);
    byParent.set(node.parentId, list);
  }

  function recurse(parentId: string | null, depth: number): TreeNode[] {
    const children = byParent.get(parentId) ?? [];
    return children
      .sort((a, b) => a.position.localeCompare(b.position))
      .map((node) => ({
        ...node,
        depth,
        children: recurse(node.id, depth + 1),
      }));
  }

  return recurse(null, 0);
}

// Flatten tree into a display list
// 将树展平为显示列表
function flattenTree(nodes: TreeNode[]): TreeNode[] {
  const result: TreeNode[] = [];
  for (const node of nodes) {
    result.push(node);
    result.push(...flattenTree(node.children));
  }
  return result;
}

export function BookContentTree({
  nodes,
}: {
  readonly nodes: readonly ContentStructureNodeDTO[];
}) {
  const [t] = useT();

  const flatList = useMemo(() => {
    const tree = buildTree(nodes);
    return flattenTree(tree);
  }, [nodes]);

  if (flatList.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <FileTextIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">{t.book.emptyContent}</p>
      </div>
    );
  }

  // Pre-compute sequential numbers for content nodes (skip section groups)
  // 预计算内容节点的序号（跳过分组标题）
  const contentIndices = new Map<string, number>();
  flatList.reduce((idx, node) => {
    if (!node.noContent) {
      contentIndices.set(node.id, idx + 1);
      return idx + 1;
    }
    return idx;
  }, 0);

  return (
    <ul className="divide-border divide-y">
      {flatList.map((node) => {
        return (
          <li
            key={node.id}
            className="flex items-center gap-2 py-2.5"
            style={{ paddingLeft: `${node.depth * 1.25}rem` }}
          >
            {node.noContent ? (
              <FolderIcon className="text-muted-foreground size-4 shrink-0" />
            ) : (
              <ChevronRightIcon className="text-muted-foreground size-4 shrink-0" />
            )}
            <span className="min-w-0 truncate text-sm">
              {!node.noContent && (
                <span className="text-muted-foreground mr-1.5 tabular-nums">
                  {contentIndices.get(node.id)}.
                </span>
              )}
              {node.title}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ContentTreeInner({ bookId }: { readonly bookId: string }) {
  const result = useAtomSuspense(bookContentStructureQuery(bookId));

  return <BookContentTree nodes={result.value.nodes} />;
}

/**
 * Book content tab showing the table of contents / content structure tree.
 * 书籍内容标签页，展示目录/内容结构树。
 *
 * ```
 * Mobile (<640px):
 * +----------------------------+
 * | > 1. Chapter Title         |
 * | > 2. Chapter Title         |
 * |   [folder] Section Group   |
 * |     > 3. Sub-chapter       |
 * |     > 4. Sub-chapter       |
 * +----------------------------+
 * w-full. Nested items indented by depth * 1.25rem.
 * Each row: icon (shrink-0) + title (truncate).
 * Section groups use folder icon; content nodes use chevron.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | > 1. Chapter Title                   |
 * | > 2. Chapter Title                   |
 * |   [folder] Section Group             |
 * |     > 3. Sub-chapter                 |
 * |     > 4. Sub-chapter                 |
 * +--------------------------------------+
 * Same structure, wider parent container.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------+
 * | > 1. Chapter Title                   |
 * | > 2. Chapter Title                   |
 * |   [folder] Section Group             |
 * |     > 3. Sub-chapter                 |
 * +--------------------------------------+
 * Same structure. Parent caps max-w-3xl.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop. Parent caps max-w-3xl.
 * ```
 *
 * 所有断点布局一致，仅宽度随父容器变化。
 * 空状态：居中图标 + 提示文字。
 * 嵌套层级通过左缩进区分，section group 用文件夹图标标识。
 */
export function BookContentTab({
  paramsPromise,
}: {
  readonly paramsPromise: Promise<{ id: string }>;
}) {
  const { id } = use(paramsPromise);

  return (
    <div className="py-4">
      <ClientOnly>
        <SectionBoundary>
          <ContentTreeInner bookId={id} />
        </SectionBoundary>
      </ClientOnly>
    </div>
  );
}
