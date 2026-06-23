import type { ReactNode } from "react";
import { AdminNav } from "./nav";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | Admin                       |
 * | [Dashboard|Users|Realms...] |
 * |  ^tabs, overflow-x-auto    |
 * |-----------------------------|
 * | {children}                  |
 * +-----------------------------+
 * 移动端无侧边导航。
 *
 * Tablet (640-1023px):
 * 同移动端。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | ADMIN                                    |
 * | [sidebar w-48] | {children, flex-1}      |
 * |  Dashboard     |                         |
 * |  Users         |                         |
 * |  Realms        |                         |
 * |  Books         |                         |
 * |  Tags          |                         |
 * |  Governance    |                         |
 * +------------------------------------------+
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 */
export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex gap-8">
      <AdminNav />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
