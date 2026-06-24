import {
  type BookshelfViewConfig,
  type CatalogUnitType,
  CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE,
  DEFAULT_BOOKSHELF_CONFIG,
  isLibraryKind,
  type LibraryKind,
  UnitType,
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
 * Cover aspect ratio for a shelf library kind, defaulting to the book cover
 * ratio. Shelf payloads use lowercase kinds, so this adapts them to the
 * Unit-level catalog cover contract.
 * 给定 shelf library 类型的封面宽高比，默认采用书籍封面比例。Shelf payload
 * 使用小写 kind，因此这里将其适配到 Unit 级目录封面 contract。
 */
export function coverAspectRatioForLibraryKind(kind: string): number {
  const catalogType = isLibraryKind(kind)
    ? catalogUnitTypeForLibraryKind(kind)
    : null;
  return CATALOG_UNIT_COVER_ASPECT_RATIO_BY_TYPE[catalogType ?? UnitType.BOOK];
}

function catalogUnitTypeForLibraryKind(kind: LibraryKind): CatalogUnitType {
  if (kind === "game") return UnitType.GAME;
  if (kind === "media") return UnitType.MEDIA;
  return UnitType.BOOK;
}
