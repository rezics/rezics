"use client";

import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import { BookOpenIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function BookLayoutShell({
  bookId,
  children,
}: {
  readonly bookId: string;
  readonly children: ReactNode;
}) {
  const pathname = usePathname();
  const [t] = useT();
  const base = `/book/${bookId}`;

  const tabs = [
    { href: base, label: t.book.content, exact: true },
    { href: `${base}/discussion`, label: t.book.discussion },
    { href: `${base}/review`, label: t.book.reviews },
    { href: `${base}/info`, label: t.book.info },
  ] as const;

  return (
    <>
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center rounded-md sm:h-40 sm:w-28">
          <BookOpenIcon className="text-muted-foreground size-8" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">{t.nav.books}</h1>
          <p className="text-muted-foreground truncate text-sm">
            {t.book.placeholder}
          </p>
        </div>
      </div>

      <nav className="border-border flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const isActive = ("exact" in tab && tab.exact)
            ? pathname === tab.href
            : pathname.startsWith(tab.href);
          return (
            <Link
              className={cn(
                "whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
                isActive
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

      {children}
    </>
  );
}
