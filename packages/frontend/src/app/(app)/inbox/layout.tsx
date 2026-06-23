"use client";

import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function InboxLayout({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const [t] = useT();

  const tabs = [
    { href: "/inbox/notifications", label: t.nav.notifications },
    { href: "/inbox/conversations", label: t.nav.messages },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">{t.nav.inbox}</h1>
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium",
              pathname === tab.href
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
            href={tab.href}
            key={tab.href}
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
