/**
 * QueryBoundary — tristate render-prop wrapper for TanStack Query results.
 * Converges the five divergent hand-rolled loading/error/empty patterns found
 * across ~40 list and section components into one authoritative primitive.
 *
 * QueryBoundary — TanStack Query 结果的三态渲染 prop 包装器。
 * 将分散在约 40 个列表和 section 组件中的五种手写加载/错误/空状态模式
 * 收敛为一个权威原语。
 *
 * @layout
 *
 * All four breakpoints render identically — a centered single-column block
 * that expands to fill the available content width. The loading/empty/error
 * states are always center-aligned; the `children` branch renders as-is.
 *
 * Mobile <640px:
 *   +----------------------+
 *   |   [Spinner / Empty]  |
 *   +----------------------+
 *
 * Tablet 640-1023px:
 *   +------------------------------+
 *   |      [Spinner / Empty]       |
 *   +------------------------------+
 *
 * Desktop 1024-1535px:
 *   +------------------------------------------+
 *   |           [Spinner / Empty]              |
 *   +------------------------------------------+
 *
 * Ultra-wide >=1536px:
 *   +--------------------------------------------------+
 *   |                [Spinner / Empty]                 |
 *   +--------------------------------------------------+
 *
 * The component itself carries no max-width constraint; it fills whatever
 * container the caller provides.
 */

import { EmptyState, type EmptyStateProps, Spinner } from "@rezics/ui";
import type { ReactNode } from "react";
import { QueryErrorDisplay } from "./QueryErrorDisplay";

/** Minimal pick of TanStack Query's UseQueryResult shape that QueryBoundary needs. */
// TanStack Query UseQueryResult 的最小 pick，只取 QueryBoundary 需要的字段
export interface QueryLike<TData> {
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  data: TData | undefined;
}

export interface QueryBoundaryProps<TData> {
  query: QueryLike<TData>;
  /**
   * Returns `true` when data is present but logically empty (e.g. empty list).
   * Defaults to `false` — callers must opt in.
   *
   * 当数据存在但逻辑上为空（如空列表）时返回 `true`。
   * 默认为 `false`，调用方需主动启用。
   */
  isEmpty?: (data: TData) => boolean;
  /**
   * Custom empty state node. If omitted, renders a default `EmptyState` using
   * `emptyTitle` (required when `isEmpty` is provided).
   *
   * 自定义空状态节点。省略时使用 `emptyTitle` 渲染默认 `EmptyState`。
   */
  empty?: ReactNode;
  /**
   * Title for the default `EmptyState`. Required when `isEmpty` is provided
   * and `empty` is not.
   *
   * 默认 `EmptyState` 的标题。当提供了 `isEmpty` 但未提供 `empty` 时必填。
   */
  emptyTitle?: string;
  /** Optional description for the default `EmptyState`. */
  // 默认 EmptyState 的可选描述
  emptyDescription?: string;
  /** Optional icon node for the default `EmptyState`. */
  // 默认 EmptyState 的可选图标节点
  emptyIcon?: EmptyStateProps["icon"];
  /**
   * Extra class names applied to the centered loading wrapper.
   * 应用于居中加载包装器的额外 class。
   */
  loadingClassName?: string;
  /** Render prop called with resolved data when not pending/error/empty. */
  // 数据就绪（非 pending/error/empty）时调用的渲染 prop
  children: (data: TData) => ReactNode;
}

/**
 * Renders the three terminal states of a TanStack Query result, then delegates
 * to `children(data)` when data is available and non-empty.
 *
 * 渲染 TanStack Query 结果的三种终态，数据可用且非空时委托给 `children(data)`。
 */
export function QueryBoundary<TData>({
  query,
  isEmpty,
  empty,
  emptyTitle,
  emptyDescription,
  emptyIcon,
  loadingClassName,
  children,
}: QueryBoundaryProps<TData>): ReactNode {
  if (query.isPending) {
    return (
      <div
        className={
          loadingClassName ?? "flex w-full items-center justify-center py-12"
        }
      >
        <Spinner size="md" />
      </div>
    );
  }

  if (query.isError) {
    return <QueryErrorDisplay error={query.error} />;
  }

  if (query.data !== undefined && isEmpty?.(query.data)) {
    if (empty !== undefined) return empty;
    return (
      <EmptyState
        title={emptyTitle ?? ""}
        description={emptyDescription}
        icon={emptyIcon}
      />
    );
  }

  if (query.data === undefined) return null;

  return children(query.data);
}
