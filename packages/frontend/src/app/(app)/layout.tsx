import { BottomNav } from "@/components/BottomNav";
import { Header } from "@/components/Header";
import { Sidebar } from "@/components/Sidebar";
import { AuthDialog } from "@/components/shared/AuthDialog";
import { Toaster } from "@/components/ui/toast";
import type { ReactNode } from "react";

/**
 * Mobile (<640px)
 * +----------------------------------+
 * | [Header -- sticky top, full w]   |
 * +----------------------------------+
 * |                                  |
 * |  main (flex-1, px-4 py-6)        |
 * |  full width, no sidebar          |
 * |  pb-20 (bottom-nav clearance)    |
 * |                                  |
 * +----------------------------------+
 * | [BottomNav -- fixed bottom]      |
 * | Home|Books| + |Inbox|Profile     |
 * +----------------------------------+
 *
 * Tablet (640-1023px)
 * +------------------------------------------+
 * | [Header -- sticky top, full width]       |
 * +------------------------------------------+
 * |                                          |
 * |  main (flex-1, px-4 py-6)                |
 * |  full width, sidebar still hidden        |
 * |  pb-20 (bottom-nav clearance)            |
 * |                                          |
 * +------------------------------------------+
 * | [BottomNav -- fixed bottom]              |
 * | Home | Books |  +  | Inbox | Profile     |
 * +------------------------------------------+
 *
 * 移动端和平板端底部导航栏（lg:hidden）替代侧栏。
 * main 额外 pb-20 防止内容被底部导航遮挡。
 *
 * Desktop (1024-1535px)
 * +----------------------------------------------------+
 * | [Header -- sticky top, full width, max-w-5xl inner]|
 * +----------------------------------------------------+
 * | Sidebar (w-56) |  main (flex-1, px-4 py-6)         |
 * | shrink-0       |  min-w-0 (eats leftover width,    |
 * | sticky top-14  |  never squeezes sidebar)          |
 * | full height    |                                   |
 * | border-r       |                                   |
 * +----------------+-----------------------------------+
 *
 * Ultra-wide (>=1536px)
 * +================================================================+
 * |                       browser viewport                         |
 * |  +----------------------------------------------------------+  |
 * |  | [Header -- sticky top, full width, max-w-5xl inner]      |  |
 * |  +----------------------------------------------------------+  |
 * |  | Sidebar (w-56) |  main (min-w-0 flex-1, px-4 py-6)      |  |
 * |  | shrink-0       |                                         |  |
 * |  | full height    |                                         |  |
 * |  | border-r       |                                         |  |
 * |  +----------------+-----------------------------------------+  |
 * |                  ^--- max-w-6xl, mx-auto ---^                  |
 * +================================================================+
 *
 * max-w-6xl 居中（w-full 必备：body 是 flex column，无它则 mx-auto
 * 取消 stretch、壳容器塌缩为 fit-content）。侧栏固定宽度，lg 以下隐藏。
 * 匿名用户可浏览；登录/注册通过 AuthDialog 弹窗完成。
 * main 设 min-w-0 防止 flex 溢出。
 */
export default function AppLayout({ children }: { readonly children: ReactNode }) {
  return (
    <>
      <Header />
      <div className="mx-auto flex w-full max-w-6xl">
        <Sidebar />
        <main className="min-w-0 flex-1 px-4 py-6 max-lg:pb-20" id="skip-nav-content">{children}</main>
      </div>
      <BottomNav />
      <Toaster />
      <AuthDialog />
    </>
  );
}
