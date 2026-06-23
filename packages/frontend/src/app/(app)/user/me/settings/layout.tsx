"use client";

import { useT } from "@/lib/i18n/locale";
import type { ReactNode } from "react";
import { SettingsNav } from "./nav";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Settings                    |
 * | [dropdown or horizontal tabs]|
 * |-----------------------------|
 * | {children}                  |
 * +-----------------------------+
 * 移动端隐藏侧边导航（max-md:hidden），
 * 依赖顶部 tab 或 URL 直接访问。
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | Settings                             |
 * | [Account] [Security] [Preferences]   |
 * |--------------------------------------|
 * | {children}                           |
 * +--------------------------------------+
 * 平板端侧边导航仍隐藏，使用水平 tabs。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | Settings                                 |
 * | [sidebar w-48] | {children, flex-1}      |
 * |  Account       |                         |
 * |  Security      |                         |
 * |  Preferences   |                         |
 * |  Notifications |                         |
 * |  Connections   |                         |
 * |  Library       |                         |
 * |  API Tokens    |                         |
 * +------------------------------------------+
 * 侧边导航 w-48 + 内容区 flex-1。
 *
 * Ultra-wide (>=1536px):
 * 与 Desktop 一致。
 */
export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  const [t] = useT();

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <h1 className="text-2xl font-bold">{t.nav.settings}</h1>
      <div className="flex gap-8">
        <SettingsNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
