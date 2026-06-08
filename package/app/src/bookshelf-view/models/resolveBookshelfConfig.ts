import {
  type BookshelfViewConfig,
  DEFAULT_BOOKSHELF_CONFIG,
  isLibraryKind,
  LIBRARY_KIND_ASPECT_RATIO,
  type LibraryKind,
} from "@rezics/contract";

/**
 * Resolve the effective bookshelf config following the precedence order
 * defined by `shelf-collection`: URL override → viewer's stored settings →
 * contract default. A partial/invalid source falls through to the next.
 * 按 `shelf-collection` 定义的优先级顺序解析生效的书架配置：
 * URL 覆盖 → 查看者已保存的设置 → 契约默认值。
 * 部分/无效的来源会回退到下一个。
 */
export function resolveBookshelfConfig(sources: {
  url?: BookshelfViewConfig | null;
  viewer?: BookshelfViewConfig | null;
}): BookshelfViewConfig {
  return (
    normalizeConfig(sources.url) ??
    normalizeConfig(sources.viewer) ??
    DEFAULT_BOOKSHELF_CONFIG
  );
}

/**
 * A config is usable only when it has at least one breakpoint.
 * 仅当配置至少有一个断点时才可用。
 */
function normalizeConfig(
  config: BookshelfViewConfig | null | undefined,
): BookshelfViewConfig | null {
  if (!config || config.breakpoints.length === 0) return null;
  return {
    breakpoints: [...config.breakpoints].sort(
      (a, b) => a.minWidthPx - b.minWidthPx,
    ),
    showTitle: config.showTitle,
  };
}

/**
 * Column count for a container width: the last breakpoint whose
 * `minWidthPx` is <= `widthPx`, falling back to the first breakpoint.
 * 给定容器宽度对应的列数：`minWidthPx` <= `widthPx` 的最后一个断点，
 * 否则回退到第一个断点。
 */
export function columnsForWidth(
  config: BookshelfViewConfig,
  widthPx: number,
): number {
  const sorted = [...config.breakpoints].sort(
    (a, b) => a.minWidthPx - b.minWidthPx,
  );
  let columns = sorted[0]?.columns ?? 1;
  for (const bp of sorted) {
    if (widthPx >= bp.minWidthPx) columns = bp.columns;
  }
  return columns;
}

/**
 * Aspect ratio for a library kind, defaulting to the book ratio.
 * 给定书库类型的宽高比，默认采用书籍比例。
 */
export function aspectRatioForKind(kind: string): number {
  return isLibraryKind(kind)
    ? LIBRARY_KIND_ASPECT_RATIO[kind as LibraryKind]
    : LIBRARY_KIND_ASPECT_RATIO.book;
}
