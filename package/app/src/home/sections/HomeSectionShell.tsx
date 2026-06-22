import { Spinner } from "@rezics/ui";
import { buttonVariants } from "@rezics/ui/shadcn";
import type React from "react";
import { QueryErrorDisplay } from "@/core";
import { AppSafeLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";

/**
 * Shared shell for home page sections: consistent h2 title, optional "more"
 * link, inline loading spinner, and error-state early return.
 * 主页区块共享外壳：统一 h2 标题、可选「更多」链接、内联加载 spinner、
 * 错误态提前返回。
 *
 * All breakpoints (single-column, no layout shift):
 * ┌─────────────────────────────────────────┐
 * │ Title                [spinner] [More →] │  h2 font-semibold, mb-4
 * │ {children}                              │
 * └─────────────────────────────────────────┘
 *
 * Error state:
 * ┌─────────────────────────────────────────┐
 * │ Title                                   │
 * │ [QueryErrorDisplay]                     │
 * └─────────────────────────────────────────┘
 */
export function HomeSectionShell({
  title,
  moreHref,
  moreLabel,
  more,
  isLoading,
  error,
  className,
  children,
}: {
  title: string;
  moreHref?: string;
  moreLabel?: string;
  /** Custom "more" slot — overrides moreHref/moreLabel. 自定义「更多」插槽——覆盖 moreHref/moreLabel。 */
  more?: React.ReactNode;
  isLoading?: boolean;
  error?: Error | unknown | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (error) {
    return (
      <section className={cn("w-full", className)}>
        <h2 className="font-semibold mb-4">{title}</h2>
        <QueryErrorDisplay error={error instanceof Error ? error : null} />
      </section>
    );
  }

  const moreNode =
    more ??
    (moreHref ? (
      <AppSafeLink
        href={moreHref}
        className={buttonVariants({ variant: "ghost" })}
      >
        {moreLabel}
      </AppSafeLink>
    ) : null);

  return (
    <section className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold">{title}</h2>
        <div className="flex items-center gap-2">
          {isLoading && <Spinner size="sm" />}
          {moreNode}
        </div>
      </div>
      {children}
    </section>
  );
}
