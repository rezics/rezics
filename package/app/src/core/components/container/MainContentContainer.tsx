import type React from "react";
import { cn } from "@/shared/utils/css-util";

type MainContentContainerWidth = "content" | "wide";

export interface MainContentContainerProps {
  children: React.ReactNode;
  className?: string;
  width?: MainContentContainerWidth;
}

/**
 * Main content area wrapper — constrains and centers page content at each breakpoint.
 * 主内容区域包装器，在各断点下约束并居中页面内容。
 *
 * Two width modes / 两种宽度模式:
 *   - `"content"` (default): 87.5% viewport width on md+, capped at 1280 px.
 *   - `"wide"`: full width up to max-w-screen-xl (1280 px) with px-6 on md+.
 *
 * Sits inside the main scrollable area; the sidebar and header are rendered
 * outside this component by the shell layout. / 该组件位于主滚动区域内；侧边栏和
 * 顶部导航由外层 shell 布局渲染，不在此组件范围内。
 *
 * ---
 *
 * **`width="content"` breakpoints / `width="content"` 各断点布局:**
 *
 * Mobile (<640 px) — full width, px-4 gutter / 移动端：全宽，两侧 px-4 间距
 * ```
 * |<------ 100vw ------>|
 * | px-4 [content] px-4 |
 * ```
 *
 * Tablet (640 px – 1023 px) — 87.5 % (w-14/16), no px, centered / 平板：87.5% 宽度，无内边距，居中
 * ```
 * |<--------- vw -------->|
 * |  [  87.5% content  ]  |
 * ```
 *
 * Desktop (1024 px – 1535 px) — 87.5 %, capped at 1280 px / 桌面：87.5% 且不超过 1280 px
 * ```
 * |<---------- vw ---------->|
 * |  auto [  ≤1280px  ] auto |
 * ```
 *
 * Ultra-wide (≥1536 px) — pinned at 1280 px, centered / 超宽屏：固定 1280 px，居中
 * ```
 * |<------------- vw ------------->|
 * |    auto [  1280px  ] auto      |
 * ```
 *
 * ---
 *
 * **`width="wide"` breakpoints / `width="wide"` 各断点布局:**
 *
 * Mobile (<768 px) — full width, px-4 / 移动端：全宽，px-4
 * ```
 * |<------ 100vw ------>|
 * | px-4 [content] px-4 |
 * ```
 *
 * Tablet/Desktop (768 px – 1279 px) — full width, px-6 / 平板/桌面：全宽，px-6
 * ```
 * |<--------- vw -------->|
 * | px-6 [ content ] px-6 |
 * ```
 *
 * Ultra-wide (≥1280 px) — pinned at screen-xl (1280 px), px-6, centered / 超宽屏：固定 1280 px，px-6，居中
 * ```
 * |<------------- vw ------------->|
 * | auto px-6 [ 1280px ] px-6 auto |
 * ```
 */
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
