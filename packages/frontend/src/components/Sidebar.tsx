"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { BookOpenIcon, CompassIcon, HomeIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function NavLink({
  href,
  icon,
  label,
  active,
}: {
  readonly href: string;
  readonly icon: React.ReactNode;
  readonly label: string;
  readonly active: boolean;
}) {
  return (
    <Link
      className={cn(
        "hover:bg-accent flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
        active && "bg-accent font-medium",
      )}
      href={href}
    >
      {icon}
      {label}
    </Link>
  );
}

/**
 * Mobile (<640px)
 *
 * (hidden -- max-lg:hidden, not rendered; replaced by BottomNav)
 *
 * Tablet (640-1023px)
 *
 * (hidden -- max-lg:hidden, not rendered; replaced by BottomNav)
 *
 * 移动端和平板端均不显示侧栏（max-lg:hidden，断点 lg = 1024px）。
 * 等价导航通过底部导航栏 BottomNav 提供。
 *
 * Desktop (1024-1535px)
 *
 * +---------------------+
 * | [Home]              |
 * | [Realms]            |
 * | [Books]             |
 * | [Explore]           |
 * |---------------------|
 * | REALMS              |
 * | (av) LongRealmNam.. |  <- name truncate, avatar shrink-0
 * | (av) Realm B        |
 * | View all realms     |
 * +---------------------+
 * w-56, sticky top-14
 * h = 100svh - 3.5rem
 * border-r, overflow-y-auto
 *
 * Ultra-wide (>=1536px)
 *
 * +---------------------+
 * | [Home]              |
 * | [Realms]            |
 * | [Books]             |
 * | [Explore]           |
 * |---------------------|
 * | REALMS              |
 * | (av) LongRealmNam.. |  <- name truncate, avatar shrink-0
 * | (av) Realm B        |
 * | View all realms     |
 * +---------------------+
 * w-56, sticky top-14
 * h = 100svh - 3.5rem
 * border-r, overflow-y-auto
 *
 * 与 Desktop 结构完全一致，侧栏宽度固定 w-56 不随视口增长。
 *
 * 紧贴 header 下方（top-14 = 3.5rem），sticky 定位占满剩余视口高度。
 * shrink-0 防止被 flex 压缩。右侧边框分隔。独立滚动（overflow-y-auto）。
 * 当前版本不显示已加入 realm 列表（需要后端 API 联通后启用）。
 * 边界：0 个已加入 realm → 分隔线和列表完全隐藏。
 */
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-14 flex h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r py-3 pr-2 max-lg:hidden">
      <div className="flex flex-col gap-0.5">
        <NavLink active={pathname === "/"} href="/" icon={<HomeIcon className="size-4" />} label="Home" />
        <NavLink
          active={pathname.startsWith("/r")}
          href="/r"
          icon={<UsersIcon className="size-4" />}
          label="Realms"
        />
        <NavLink
          active={pathname.startsWith("/book")}
          href="/book"
          icon={<BookOpenIcon className="size-4" />}
          label="Books"
        />
        <NavLink
          active={pathname === "/search"}
          href="/search"
          icon={<CompassIcon className="size-4" />}
          label="Explore"
        />
      </div>
    </nav>
  );
}
