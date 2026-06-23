"use client";

import { useT } from "@/lib/i18n/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

export default function UserLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { id } = useParams<{ id: string }>();
  const [t] = useT();

  const tabs = [
    { href: "", label: t.user.posts },
    { href: "/reviews", label: t.user.reviews },
    { href: "/shelves", label: t.nav.shelves },
    { href: "/realms", label: t.nav.realms },
  ] as const;

  return (
    <div className="space-y-6">
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm font-medium"
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
