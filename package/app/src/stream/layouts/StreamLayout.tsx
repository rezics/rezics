import type React from "react";
import { cn } from "@/shared/utils/css-util";

export interface StreamLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Width wrapper for stream streams. Broad page containers remain owned by page
 * features or core layout primitives.
 */
export function StreamLayout({ children, className }: StreamLayoutProps) {
  return (
    <div className={cn("mx-auto w-full max-w-[800px]", className)}>
      {children}
    </div>
  );
}
