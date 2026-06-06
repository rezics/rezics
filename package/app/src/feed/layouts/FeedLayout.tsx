import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface FeedLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Width wrapper for feed streams. Broad page containers remain owned by page
 * features or core layout primitives.
 */
export function FeedLayout({ children, className }: FeedLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[800px]", className)}>
      {children}
    </div>
  );
}
