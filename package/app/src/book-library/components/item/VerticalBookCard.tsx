import { BookOpen } from "lucide-react";
import type React from "react";
import { Link } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util.ts";

export type BookProps = {
  title: string;
  author?: string;
  coverUrl: string;
  href?: string;
  onClick?: () => void;
  className?: string;
  /** When false, the title/author block is hidden (cover-only grids). 为 false 时隐藏标题/作者块（仅封面网格）。 */
  showTitle?: boolean;
  /**
   * Cover aspect ratio (width / height). When set, the cover box reserves
   * the ratio so grid rows align before images load.
   * 封面宽高比（width / height）。设置后封面框会预留该比例，
   * 使图片加载前网格行即可对齐。
   */
  aspectRatio?: number;
};

export function BookCard({
  title,
  author,
  coverUrl,
  href,
  onClick,
  className,
  showTitle = true,
  aspectRatio,
}: BookProps) {
  const Root: React.ElementType = href ? Link : "button";
  const rootProps = href ? { to: href } : { type: "button" as const, onClick };
  const hasCover = coverUrl.trim().length > 0;

  return (
    <Root
      {...rootProps}
      className={cn("block text-left", className ?? "")}
      aria-label={title}
    >
      <div
        className="relative w-full overflow-hidden"
        style={aspectRatio ? { aspectRatio } : undefined}
      >
        {hasCover ? (
          <img
            src={coverUrl}
            alt={title}
            className={cn(
              "w-full object-cover rounded",
              aspectRatio ? "h-full" : "",
            )}
            loading="lazy"
          />
        ) : (
          <div
            className={cn(
              "flex w-full items-center justify-center rounded bg-surface-subtle text-text-tertiary",
              aspectRatio ? "h-full" : "aspect-[2/3]",
            )}
            aria-hidden="true"
          >
            <BookOpen className="h-8 w-8" />
          </div>
        )}
      </div>

      {showTitle ? (
        <div className="mt-2">
          <div title={title} className="line-clamp-2 text-sm font-bold mb-1">
            {title}
          </div>

          {author ? <div className="line-clamp-1 text-sm">{author}</div> : null}
        </div>
      ) : null}
    </Root>
  );
}
