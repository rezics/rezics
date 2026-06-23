"use client";

import { useT } from "@/lib/i18n/locale";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { ReactNode } from "react";

export default function ManageRealmLayout({
  children,
}: {
  readonly children: ReactNode;
}) {
  const { slug } = useParams<{ slug: string }>();
  const [t] = useT();

  const sections = [
    { suffix: "profile", label: t.manage.profile },
    { suffix: "members", label: t.manage.members },
    { suffix: "moderation", label: t.manage.moderation },
    { suffix: "dock", label: t.manage.dock },
  ];

  return (
    <div className="flex gap-8">
      <nav className="hidden w-44 shrink-0 md:block">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">{t.manage.title}</h2>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.suffix}>
              <Link
                className="text-muted-foreground hover:text-foreground block rounded-md px-3 py-2 text-sm"
                href={`/r/${slug}/manage/${s.suffix}`}
              >
                {s.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
