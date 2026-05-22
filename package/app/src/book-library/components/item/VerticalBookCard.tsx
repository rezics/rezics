import { Link } from "@/shared/ui/link";
import type React from "react";
import { cn } from "@/shared/utils/css-util.ts";

export type BookProps = {
  title: string;
  author?: string;
  coverUrl: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function BookCard({
  title,
  author,
  coverUrl,
  href,
  onClick,
  className,
}: BookProps) {
  const Root: React.ElementType = href ? Link : "button";
  const rootProps = href ? { to: href } : { type: "button" as const, onClick };

  return (
    <Root
      {...rootProps}
      className={cn("block text-left", className ?? "")}
      aria-label={title}
    >
      <div className="relative w-full overflow-hidden">
        <img
          src={coverUrl}
          alt={title}
          className="w-full object-cover rounded"
          loading="lazy"
        />
      </div>

      <div className="mt-2">
        <div title={title} className="line-clamp-2 text-sm font-bold mb-1">
          {title}
        </div>

        {author ? <div className="line-clamp-1 text-sm">{author}</div> : null}
      </div>
    </Root>
  );
}
