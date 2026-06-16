import { useMemo } from "react";
import { useCurrentBreakpoint } from "@/core";
import { cn } from "@/shared/utils/css-util";
import {
  HorizontalBookCard,
  type HorizontalBookProps,
} from "../item/HorizontalBookCard";

type Breakpoint = "xs" | "xsm" | "sm" | "md" | "lg" | "xl";

interface ResponsiveBookGridLimitedProps {
  bookList: (HorizontalBookProps & { id: string })[];
  className?: string;
}

/**
 * Responsive Book Grid Limited - Responsive grid with breakpoint-based layout.
 * 响应式图书网格有限版——带有断点感知布局的响应式网格。
 *
 * Displays a limited (row × column) grid of books, automatically adjusting
 * layout based on current breakpoint. Prevents CLS via fixed column counts.
 *
 * Mobile <640px (xs/xsm):
 * +-----+
 * |Book | 4 rows
 * |     | 1 col
 * | ... |
 * +-----+
 *
 * Tablet 640-1023px (sm):
 * +-----+-----+
 * |Book | Book| 3 rows
 * |     |     | 2 cols
 * | ... | ... |
 * +-----+-----+
 *
 * Desktop 1024-1535px (md):
 * +-----+-----+-----+
 * |Book | Book| Book| 3 rows
 * |     |     |     | 3 cols
 * | ... | ... | ... |
 * +-----+-----+-----+
 *
 * Large Desktop (lg):
 * +---+---+---+---+
 * |Bk | Bk| Bk| Bk| 2 rows
 * |   |   |   |   | 4 cols
 * +---+---+---+---+
 *
 * Ultra-wide >=1536px (xl):
 * +---+---+---+---+---+
 * |Bk | Bk| Bk| Bk| Bk| 2 rows
 * |   |   |   |   |   | 5 cols
 * +---+---+---+---+---+
 */
const layoutConfig: Record<Breakpoint, { rows: number; columns: number }> = {
  xs: { rows: 4, columns: 1 },
  xsm: { rows: 4, columns: 1 },
  sm: { rows: 3, columns: 2 },
  md: { rows: 3, columns: 3 },
  lg: { rows: 2, columns: 4 },
  xl: { rows: 2, columns: 5 },
};

/**
 * 显式 class 映射，防止 UnoCSS/Tailwind 丢失生成
 */
const columnClassMap: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/**
 * ResponsiveBookGridLimited - Render limited grid of books per breakpoint.
 * 响应式图书网格有限版——按断点渲染有限数量的图书网格。
 *
 * Slices bookList to maxItems (rows × columns), then renders via grid layout.
 * Uses explicit column class to prevent UnoCSS/Tailwind purge issues.
 */
export function ResponsiveBookGridLimited({
  bookList,
  className,
}: ResponsiveBookGridLimitedProps) {
  const breakpoint = useCurrentBreakpoint();

  const { rows, columns } = layoutConfig[breakpoint];

  const maxItems = rows * columns;

  const visibleBooks = useMemo(
    () => bookList.slice(0, maxItems),
    [bookList, maxItems],
  );

  return (
    <div className={cn("grid gap-8", columnClassMap[columns], className)}>
      {visibleBooks.map((book) => (
        <HorizontalBookCard key={book.id} {...book} />
      ))}
    </div>
  );
}
