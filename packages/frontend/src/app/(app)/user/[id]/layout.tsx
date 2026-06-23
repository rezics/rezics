"use client";

import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function UserLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const pathname = usePathname();
  const [t] = useT();

  const tabs = [
    { href: "", label: t.user.posts },
    { href: "/reviews", label: t.user.reviews },
    { href: "/shelves", label: t.nav.shelves },
    { href: "/realms", label: t.nav.realms },
  ] as const;

  function isActive(tabHref: string) {
    const full = `/user/${id}${tabHref}`;
    if (tabHref === "") return pathname === `/user/${id}` || pathname === `/user/${id}/posts`;
    return pathname === full;
  }

  return (
    <div className="space-y-6">
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              isActive(tab.href)
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            href={`/user/${id}${tab.href}`}
            key={tab.label}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
