"use client";

import { authDialogAtom } from "@/atoms/auth-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger } from "@/components/ui/menu";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/locale";
import { useAtomSet } from "@effect/atom-react";
import { BellIcon, BookOpenIcon, PlusIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { FormEvent } from "react";

/**
 * Mobile (<640px)
 *
 * Logged in:
 * +--------------------------------------+
 * | Logo  [ Search... ]           (Av)  |
 * +--------------------------------------+
 *          ^-mx-auto-^      avatar menu
 *
 * Anonymous:
 * +--------------------------------------+
 * | Logo  [ Search... ]  [SignIn][SignUp]|
 * +--------------------------------------+
 *
 * 移动端导航由底部 BottomNav 接管，Header 仅保留 Logo、搜索和头像菜单。
 * 创建和通知铃铛移至底部导航栏（max-lg:hidden）。
 *
 * Tablet (640-1023px)
 *
 * Logged in:
 * +----------------------------------------------+
 * | Logo     [   Search...   ]            (Av)  |
 * +----------------------------------------------+
 *            ^--mx-auto, max-w-md--^
 *
 * Anonymous:
 * +----------------------------------------------+
 * | Logo     [   Search...   ]  [SignIn] [SignUp]|
 * +----------------------------------------------+
 *
 * 与移动端一致——创建/通知在底部导航栏。
 *
 * Desktop (1024-1535px)
 *
 * Logged in:
 * +--------------------------------------------------------------+
 * | Logo        [    Search...    ]      [+ Post] [Bell] (Av)   |
 * +--------------------------------------------------------------+
 *               ^-mx-auto, max-w-md-^    gap-3 spacing
 *
 * Anonymous:
 * +--------------------------------------------------------------+
 * | Logo        [    Search...    ]       [Sign in] [Sign up]   |
 * +--------------------------------------------------------------+
 *
 * Ultra-wide (>=1536px)
 *
 * Logged in:
 * +=================================================================+
 * |      | Logo     [   Search...  ]     [+ Post] [Bell] (Av) |    |
 * +=================================================================+
 *        ^------------- max-w-5xl, mx-auto -------------------^
 *
 * 吸顶 z-40，半透明模糊背景，下边框。
 * 搜索框 mx-auto w-full max-w-md。
 * 行宽处置：logo + 右侧动作组 shrink-0，搜索框唯一可收缩项（min-w-0）；
 * 宽端 max-w-md 封顶，整行 max-w-5xl 封顶。
 * 已登录动作组控件等高：+Post（md,h-8）、铃铛（icon-md,size-8）、头像（md,size-8）均 32px。
 */
export function Header() {
  const router = useRouter();
  const [t] = useT();
  const { data: session } = authClient.useSession();
  const setAuthDialog = useAtomSet(authDialogAtom);

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q");
    if (typeof q === "string" && q.trim().length > 0) {
      router.push(`/search?q=${encodeURIComponent(q.trim())}`);
    }
  }

  function handleMenuSelect({ value }: { readonly value: string }) {
    if (value === "sign-out") {
      authClient.signOut().then(() => router.refresh());
      return;
    }
    router.push(value);
  }

  return (
    <header className="bg-background/90 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-2.5">
        <Link className="shrink-0 text-lg font-semibold" href="/">
          <BookOpenIcon className="mr-1.5 inline-block size-5 align-text-bottom" />
          rezics
        </Link>

        <form className="mx-auto w-full max-w-md" onSubmit={handleSearch}>
          <Input
            aria-label={t.nav.searchPlaceholder}
            name="q"
            placeholder={t.nav.searchPlaceholder}
            type="search"
          />
        </form>

        {session ? (
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild className="max-lg:hidden" size="md" variant="ghost">
              <Link href="/create">
                <PlusIcon />
                <span className="hidden sm:inline">{t.nav.createPost}</span>
              </Link>
            </Button>

            <Button asChild aria-label={t.nav.notifications} className="max-lg:hidden" size="icon-md" variant="ghost">
              <Link href="/inbox">
                <BellIcon />
              </Link>
            </Button>

            <Menu onSelect={handleMenuSelect}>
              <MenuTrigger
                aria-label={session.user.name}
                className="focus-visible:ring-ring/32 rounded-full outline-none focus-visible:ring-[3px]"
              >
                <Avatar size="md">
                  <AvatarImage alt={session.user.name} src={session.user.image ?? undefined} />
                  <AvatarFallback>{session.user.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
              </MenuTrigger>
              <MenuContent className="min-w-48">
                <MenuItem value={`/user/${session.user.id}`}>{t.nav.profile}</MenuItem>
                <MenuItem value="/user/me/shelves">{t.nav.shelves}</MenuItem>
                <MenuItem value="/inbox">{t.nav.inbox}</MenuItem>
                <MenuSeparator />
                <MenuItem value="/user/me/settings/account">{t.nav.settings}</MenuItem>
                <MenuItem value="sign-out">{t.nav.signOut}</MenuItem>
              </MenuContent>
            </Menu>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            <Button onClick={() => setAuthDialog({ open: true, mode: "login" })} size="sm" variant="ghost">
              {t.nav.signIn}
            </Button>
            <Button onClick={() => setAuthDialog({ open: true, mode: "register" })} size="sm">
              {t.nav.signUp}
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
