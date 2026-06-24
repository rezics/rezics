"use client";

import { realmBySlugQuery } from "@/atoms/realms";
import { ClientOnly } from "@/components/ClientOnly";
import { JoinButton } from "@/components/realm/JoinButton";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { useAtomSuspense } from "@effect/atom-react";
import type { Realm } from "@rezics/backend/api";
import { Cause } from "effect";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { UsersIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

function isTaggedError(error: unknown, tag: string): boolean {
  return typeof error === "object" && error !== null && "_tag" in error && error._tag === tag;
}

export function RealmTabsView({ slug, pathname }: { readonly slug: string; readonly pathname: string }) {
  const [t] = useT();
  const tabs: Array<{ href: string; label: string; exact?: boolean }> = [
    { href: `/r/${slug}`, label: t.realms.posts, exact: true },
    { href: `/r/${slug}/shelves`, label: t.realms.shelves },
    { href: `/r/${slug}/tags`, label: t.realms.tags },
    { href: `/r/${slug}/wiki`, label: t.realms.wiki },
    { href: `/r/${slug}/rules`, label: t.realms.rules },
  ];

  return (
    <nav className="border-border flex gap-1 border-b">
      {tabs.map((tab) => {
        const active = tab.exact ? pathname === tab.href : pathname.startsWith(tab.href);
        return (
          <Link
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              active
                ? "border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground border-transparent",
            )}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}

function RealmTabs({ slug }: { readonly slug: string }) {
  const pathname = usePathname();

  return <RealmTabsView pathname={pathname} slug={slug} />;
}

export function RealmHeaderView({ realm, action }: { readonly realm: Realm; readonly action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div className="bg-muted flex size-12 shrink-0 items-center justify-center rounded-full">
        <UsersIcon className="text-muted-foreground size-6" />
      </div>
      <div className="min-w-0 flex-1">
        <h1 className="text-xl font-semibold wrap-anywhere">{realm.name}</h1>
        <p className="text-muted-foreground truncate text-sm">{realm.slug}</p>
      </div>
      {action}
    </div>
  );
}

function RealmHeader({ slug }: { readonly slug: string }) {
  const [t] = useT();
  const result = useAtomSuspense(realmBySlugQuery(slug), { includeFailure: true });

  if (AsyncResult.isFailure(result)) {
    const error = Cause.squash(result.cause);
    const notFound = isTaggedError(error, "RealmNotFound");
    return (
      <div className="flex flex-col items-center gap-2 py-12">
        <UsersIcon className="text-muted-foreground size-8" />
        <p className="text-muted-foreground text-sm">{notFound ? t.realms.notFound : t.common.error}</p>
      </div>
    );
  }

  const realm = result.value;

  return (
    <RealmHeaderView
      action={
        <ClientOnly>
          <JoinButton realmId={realm.id} />
        </ClientOnly>
      }
      realm={realm}
    />
  );
}

export function RealmDetailShell({
  realm,
  pathname,
  action,
  children,
}: {
  readonly realm: Realm;
  readonly pathname: string;
  readonly action?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4">
      <RealmHeaderView action={action} realm={realm} />
      <RealmTabsView pathname={pathname} slug={realm.slug} />
      {children}
    </div>
  );
}

/**
 * Mobile (<640px):
 * +------------------------------------------+
 * | (Icon) Realm Name                        |
 * |        slug                               |
 * |                         [Join/Leave]     |
 * |------------------------------------------|
 * | [Posts] [Shelves] [Tags] [Wiki] [Rules]  |
 * |------------------------------------------|
 * | [children]                               |
 * +------------------------------------------+
 *            w-full (fills parent)
 *
 * Tablet (640-1023px):
 * +------------------------------------------------+
 * | (Icon) Realm Name                              |
 * |        slug                                    |
 * |                            [Join/Leave]        |
 * |------------------------------------------------|
 * | [Posts] [Shelves] [Tags] [Wiki] [Rules]        |
 * |------------------------------------------------|
 * | [children]                                     |
 * +------------------------------------------------+
 *            w-full (fills parent)
 *
 * Desktop (1024-1535px):
 * +------------------------------------------------------+
 * | (Icon) Realm Name                                    |
 * |        slug                                          |
 * |                              [Join/Leave]            |
 * +------------------------------------------------------+
 * | [Posts] [Shelves] [Tags] [Wiki] [Rules]              |
 * +------------------------------------------------------+
 * | [children]                                           |
 * +------------------------------------------------------+
 *            w-full (fills parent)
 *
 * Ultra-wide (>=1536px):
 * +----------------------------------------------------------------+
 * | (Icon) Realm Name                                              |
 * |        slug                                                    |
 * |                                       [Join/Leave]             |
 * +----------------------------------------------------------------+
 * | [Posts] [Shelves] [Tags] [Wiki] [Rules]                        |
 * +----------------------------------------------------------------+
 * | [children]                                                     |
 * +----------------------------------------------------------------+
 *            w-full (fills parent)
 *
 * 无 max-w 包裹，填充父级宽度。
 * 头行宽度处置：图标自带 shrink-0；中间块 min-w-0 flex-1（吃掉余宽），
 * 名称 wrap-anywhere（超长无空格名断行）、slug 行 truncate；
 * Join/Leave 按钮 shrink-0，窄端经外层 flex-wrap 折到下一行。宽端：中间块伸展，按钮贴右。
 * Tab 导航高亮当前路由，精确匹配首页 tab（/r/slug），前缀匹配子 tab。
 * 边界：NotFound → 显示未找到提示（UsersIcon + 消息）。
 */
export function RealmDetailContent({ slug, children }: { readonly slug: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionBoundary>
        <RealmHeader slug={slug} />
      </SectionBoundary>
      <RealmTabs slug={slug} />
      {children}
    </div>
  );
}
