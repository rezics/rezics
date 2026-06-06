import type React from "react";
import { cn } from "@/shared/utils/css-util";

type MainContentContainerWidth = "content" | "wide";

export interface MainContentContainerProps {
  children: React.ReactNode;
  className?: string;
  width?: MainContentContainerWidth;
}

export function MainContentContainer({
  children,
  className,
  width = "content",
}: MainContentContainerProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full px-4",
        width === "content" && "max-w-[1280px] md:w-14/16 md:px-0",
        width === "wide" && "max-w-screen-xl md:px-6",
        className,
      )}
    >
      {children}
    </div>
  );
}
