"use client";

import { authDialogAtom } from "@/atoms/auth-dialog";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/locale";
import { useAtomSet } from "@effect/atom-react";
import { BellIcon, BookOpenIcon, HomeIcon, PlusIcon, UserIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Mobile (<640px)
 * +--------------------------------------------+
 * | Home  | Books  |  +  |  Inbox | Profile   |
 * | [ic]  |  [ic]  | [ic]|  [ic]  |  [ic]     |
 * | Home  | Books  | New | Inbox  | Profile    |
 * +--------------------------------------------+
 * fixed bottom-0, full width, border-t
 *
 * Tablet (640-1023px)
 * +--------------------------------------------+
 * | Home  | Books  |  +  |  Inbox | Profile   |
 * | [ic]  |  [ic]  | [ic]|  [ic]  |  [ic]     |
 * | Home  | Books  | New | Inbox  | Profile    |
 * +--------------------------------------------+
 * 与移动端相同。
 *
 * Desktop (1024-1535px)
 * (hidden -- lg:hidden, sidebar takes over)
 *
 * Ultra-wide (>=1536px)
 * (hidden -- lg:hidden, sidebar takes over)
 *
 * 底部固定导航栏，lg 断点以上隐藏（侧栏接管）。
 * 5 个等宽项：Home、Books、New（创建）、Inbox、Profile。
 * 当前路由高亮为 primary 色。
 * 匿名用户点击 Profile/Inbox 弹出登录对话框。
 */
export function BottomNav() {
  const pathname = usePathname();
  const [t] = useT();
  const { data: session } = authClient.useSession();
  const setAuthDialog = useAtomSet(authDialogAtom);

  const linkItems = [
    { key: "home", href: "/", icon: HomeIcon, label: t.nav.home },
    { key: "books", href: "/book", icon: BookOpenIcon, label: t.library.title },
    { key: "create", href: "/create", icon: PlusIcon, label: t.nav.createPost },
  ] as const;

  const authItems = [
    { key: "inbox", href: "/inbox", icon: BellIcon, label: t.nav.inbox },
    { key: "profile", href: "/user/me", icon: UserIcon, label: t.nav.profile },
  ] as const;

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  }

  function handleAuthClick(_href: string) {
    if (!session) {
      setAuthDialog({ open: true, mode: "login" });
    }
  }

  return (
    <nav className="bg-background/90 fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-around">
        {linkItems.map(({ key, href, icon: Icon, label }) => (
          <Link
            aria-label={label}
            className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs ${isActive(href) ? "text-primary" : "text-muted-foreground"}`}
            href={href}
            key={key}
          >
            <Icon className="size-5" />
            <span>{label}</span>
          </Link>
        ))}
        {authItems.map(({ key, href, icon: Icon, label }) =>
          session ? (
            <Link
              aria-label={label}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs ${isActive(href) ? "text-primary" : "text-muted-foreground"}`}
              href={href}
              key={key}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          ) : (
            <button
              aria-label={label}
              className={`flex flex-1 flex-col items-center gap-0.5 py-1 text-xs text-muted-foreground`}
              key={key}
              onClick={() => handleAuthClick(href)}
              type="button"
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </button>
          ),
        )}
      </div>
    </nav>
  );
}
