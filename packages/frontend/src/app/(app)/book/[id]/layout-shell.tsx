"use client";

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
  const base = `/book/${bookId}`;

  const tabs = [
    { href: base, label: "Content", exact: true },
    { href: `${base}/discussion`, label: "Discussion" },
    { href: `${base}/review`, label: "Reviews" },
    { href: `${base}/info`, label: "Info" },
  ] as const;

  return (
    <>
      <div className="flex items-start gap-4 sm:gap-6">
        <div className="bg-muted flex size-20 shrink-0 items-center justify-center rounded-md sm:h-40 sm:w-28">
          <BookOpenIcon className="text-muted-foreground size-8" />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="truncate text-xl font-bold sm:text-2xl">Book</h1>
          <p className="text-muted-foreground truncate text-sm">
            Book details will load once API is connected.
          </p>
        </div>
      </div>

      <nav className="border-border flex gap-1 overflow-x-auto border-b">
        {tabs.map((tab) => {
          const isActive = tab.exact
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
