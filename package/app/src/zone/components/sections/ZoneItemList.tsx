import type { ZoneSectionDisplay } from "@rezics/contract";
import { Image as ImageIcon } from "lucide-react";
import { AppSafeLink as SafeLink } from "@/shared/ui/link";

export type ZoneListEntry = {
  key: string;
  href: string;
  label: string;
  summary?: string | null;
  imageUrl?: string | null;
};

/**
 * Shared layout for collection/query entries. The display variants map
 * onto three restrained layouts: rows (`list`), card grids
 * (`tiles`/`grid`/`featured` — featured uses wider cells), and horizontal
 * cover rails (`carousel`/`covers`). Image units may carry no resolved URL;
 * covers fall back to an icon placeholder and inline thumbnails are skipped.
 * collection/query 条目的共享布局。六种 display 变体映射到三种克制的
 * 布局：行（`list`）、卡片网格（`tiles`/`grid`/`featured`——featured 使用
 * 更宽的单元格）与横向封面栏（`carousel`/`covers`）。图片 Unit 可能没有
 * 已解析的 URL；封面回退到图标占位，行内缩略图直接跳过。
 */
export function ZoneItemList({
  entries,
  display,
}: {
  entries: ZoneListEntry[];
  display: ZoneSectionDisplay;
}) {
  if (display === "list") {
    return (
      <ul className="flex flex-col gap-2">
        {entries.map((entry) => (
          <li key={entry.key}>
            <SafeLink
              href={entry.href}
              className="flex items-center gap-3 rounded-md bg-surface-subtle px-4 py-3 transition-colors hover:bg-surface-sunken"
            >
              {entry.imageUrl ? (
                <img
                  src={entry.imageUrl}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-sm object-cover"
                />
              ) : null}
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-ui text-text-primary">
                  {entry.label}
                </span>
                {entry.summary ? (
                  <span className="block truncate text-xs leading-dense text-text-secondary">
                    {entry.summary}
                  </span>
                ) : null}
              </span>
            </SafeLink>
          </li>
        ))}
      </ul>
    );
  }

  if (display === "carousel" || display === "covers") {
    return (
      <ul className="flex gap-4 overflow-x-auto pb-2">
        {entries.map((entry) => (
          <li key={entry.key} className="w-28 shrink-0 sm:w-32">
            <SafeLink href={entry.href} className="flex flex-col gap-2">
              <span className="flex aspect-[2/3] items-center justify-center overflow-hidden rounded-md bg-surface-subtle">
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon
                    className="size-6 text-text-tertiary"
                    aria-hidden
                  />
                )}
              </span>
              <span className="line-clamp-2 text-xs leading-dense text-text-primary">
                {entry.label}
              </span>
            </SafeLink>
          </li>
        ))}
      </ul>
    );
  }

  if (display === "avatar-wall") {
    return (
      <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
        {entries.map((entry) => (
          <li key={entry.key}>
            <SafeLink
              href={entry.href}
              className="flex min-w-0 flex-col items-center gap-2 rounded-md px-2 py-3 text-center transition-colors hover:bg-surface-subtle"
            >
              <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-surface-subtle">
                {entry.imageUrl ? (
                  <img
                    src={entry.imageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <ImageIcon
                    className="size-5 text-text-tertiary"
                    aria-hidden
                  />
                )}
              </span>
              <span className="line-clamp-2 text-xs font-medium leading-dense text-text-primary">
                {entry.label}
              </span>
            </SafeLink>
          </li>
        ))}
      </ul>
    );
  }

  const gridClass =
    display === "featured"
      ? "grid gap-3 sm:grid-cols-2"
      : "grid gap-3 sm:grid-cols-2 lg:grid-cols-3";
  return (
    <ul className={gridClass}>
      {entries.map((entry) => (
        <li key={entry.key}>
          <SafeLink
            href={entry.href}
            className="flex h-full flex-col gap-1 rounded-md bg-surface-subtle px-4 py-3 transition-colors hover:bg-surface-sunken"
          >
            <span className="text-sm font-medium leading-ui text-text-primary">
              {entry.label}
            </span>
            {entry.summary ? (
              <span className="line-clamp-2 text-xs leading-dense text-text-secondary">
                {entry.summary}
              </span>
            ) : null}
          </SafeLink>
        </li>
      ))}
    </ul>
  );
}
