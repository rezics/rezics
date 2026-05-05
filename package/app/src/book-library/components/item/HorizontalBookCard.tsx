import { Link } from "@rezics/ui/primitive/link/Link.tsx";
import type React from "react";

export type HorizontalBookProps = {
  title: string;
  author?: string;
  description?: string;
  coverUrl: string;
  href?: string;
  onClick?: () => void;
  className?: string;
};

export function HorizontalBookCard({
  title,
  author,
  description,
  coverUrl,
  href,
  onClick,
  className,
}: HorizontalBookProps) {
  const Root: React.ElementType = href ? Link : "button";
  const rootProps = href ? { to: href } : { type: "button" as const, onClick };

  return (
    <Root
      {...rootProps}
      className={[
        `
        group
        block
        w-full
        text-left
        rounded-md
        transition
        duration-200
        hover:bg-white/5
        `,
        className ?? "",
      ].join(" ")}
      aria-label={title}
    >
      <div className="flex gap-4 items-start">
        {/* Cover */}
        <div
          className="
            w-15
            sm:w-18
            shrink-0
            overflow-hidden
            rounded-md
            aspect-[2/3]
          "
        >
          <img
            src={coverUrl}
            alt={title}
            loading="lazy"
            className="
              w-full
              h-full
              object-cover
              transition-transform
              duration-300
              group-hover:scale-105
            "
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold line-clamp-1 mb-1">{title}</div>

          {author ? (
            <div className="text-xs text-gray-400 line-clamp-1 mb-1">
              {author}
            </div>
          ) : null}

          {description ? (
            <div className="text-xs text-gray-500 line-clamp-2 leading-snug">
              {description}
            </div>
          ) : null}
        </div>
      </div>
    </Root>
  );
}
