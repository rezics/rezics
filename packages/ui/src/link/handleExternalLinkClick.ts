import type { MouseEvent } from "react";
import { openExternal } from "./store";

export function handleExternalLinkClick(e: MouseEvent<HTMLElement>) {
  const target = (e.target as HTMLElement).closest<HTMLAnchorElement>(
    'a[data-link-kind="external"]',
  );
  if (!target) return;
  e.preventDefault();
  openExternal(target.href);
}
