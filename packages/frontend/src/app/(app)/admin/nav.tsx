"use client";

import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import {
  BarChart3Icon,
  BookOpenIcon,
  ShieldIcon,
  TagIcon,
  UsersIcon,
  GlobeIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function AdminNav() {
  const pathname = usePathname();
  const [t] = useT();

  const sections = [
    { href: "/admin/stats", label: t.admin.dashboard, icon: BarChart3Icon },
    { href: "/admin/users", label: t.admin.users, icon: UsersIcon },
    { href: "/admin/realms", label: t.admin.realms, icon: GlobeIcon },
    { href: "/admin/books", label: t.admin.books, icon: BookOpenIcon },
    { href: "/admin/tags", label: t.admin.tags, icon: TagIcon },
    { href: "/admin/governance", label: t.admin.governance, icon: ShieldIcon },
  ];

  return (
    <nav className="hidden w-48 shrink-0 lg:block">
      <h2 className="text-muted-foreground mb-3 px-3 text-xs font-medium tracking-wider uppercase">
        {t.admin.title}
      </h2>
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const isActive = pathname.startsWith(s.href);
          return (
            <li key={s.href}>
              <Link
                className={cn(
                  "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
                href={s.href}
              >
                <s.icon className="size-4" />
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
