import { useMemo } from "react";
import { useCurrentBreakpoint } from "@/core/hooks/useCurrentBreakpoint";
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
 * 每个 breakpoint 下的布局规则
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
