"use client";

import { myRealmsQuery } from "@/atoms/realms";
import { Separator } from "@/components/ui/separator";
import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { useAtomValue } from "@effect/atom-react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
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

// Joined realms list — renders inline, non-blocking (useAtomValue, not Suspense)
// 已加入 realm 列表 — 内联渲染、不阻塞（useAtomValue 而非 Suspense）
function JoinedRealms() {
  const [t] = useT();
  const result = useAtomValue(myRealmsQuery);

  // Don't render anything while loading or on error (anonymous users get 401)
  // 加载中或出错时不渲染（匿名用户会得到 401）
  if (!AsyncResult.isSuccess(result) || result.value.length === 0) {
    return null;
  }

  const realms = result.value;

  return (
    <>
      <Separator className="mx-3" />
      <div className="flex flex-col gap-0.5">
        <span className="text-muted-foreground px-3 py-1 text-xs font-medium uppercase tracking-wider">
          {t.realms.title}
        </span>
        {realms.map((realm) => (
          <Link
            className="hover:bg-accent flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm transition-colors"
            href={`/r/${realm.slug}`}
            key={realm.id}
          >
            <div className="bg-muted flex size-6 shrink-0 items-center justify-center rounded-full">
              <UsersIcon className="text-muted-foreground size-3" />
            </div>
            <span className="truncate">{realm.name}</span>
          </Link>
        ))}
        <Link
          className="text-muted-foreground hover:text-foreground px-3 py-1.5 text-xs transition-colors"
          href="/r"
        >
          {t.nav.allRealms}
        </Link>
      </div>
    </>
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
 * | (ic) LongRealmNam.. |  <- name truncate, icon shrink-0
 * | (ic) Realm B        |
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
 * | (ic) LongRealmNam.. |  <- name truncate, icon shrink-0
 * | (ic) Realm B        |
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
 * 已加入 realm 列表使用 useAtomValue（不阻塞渲染）；查询失败或无数据时分隔线和列表完全隐藏。
 * 边界：0 个已加入 realm → 分隔线和列表完全隐藏。
 *       未登录 → myRealmsQuery 401 → 不渲染。
 */
export function Sidebar() {
  const pathname = usePathname();
  const [t] = useT();

  return (
    <nav className="sticky top-14 flex h-[calc(100svh-3.5rem)] w-56 shrink-0 flex-col gap-2 overflow-y-auto border-r py-3 pr-2 max-lg:hidden">
      <div className="flex flex-col gap-0.5">
        <NavLink active={pathname === "/"} href="/" icon={<HomeIcon className="size-4" />} label={t.nav.home} />
        <NavLink
          active={pathname.startsWith("/r")}
          href="/r"
          icon={<UsersIcon className="size-4" />}
          label={t.nav.realms}
        />
        <NavLink
          active={pathname.startsWith("/book")}
          href="/book"
          icon={<BookOpenIcon className="size-4" />}
          label={t.nav.books}
        />
        <NavLink
          active={pathname === "/search"}
          href="/search"
          icon={<CompassIcon className="size-4" />}
          label={t.nav.explore}
        />
      </div>
      <JoinedRealms />
    </nav>
  );
}
