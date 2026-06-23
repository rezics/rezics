"use client";

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

const sections = [
  { href: "/admin/stats", label: "Dashboard", icon: BarChart3Icon },
  { href: "/admin/users", label: "Users", icon: UsersIcon },
  { href: "/admin/realms", label: "Realms", icon: GlobeIcon },
  { href: "/admin/books", label: "Books", icon: BookOpenIcon },
  { href: "/admin/tags", label: "Tags", icon: TagIcon },
  { href: "/admin/governance", label: "Governance", icon: ShieldIcon },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="hidden w-48 shrink-0 lg:block">
      <h2 className="text-muted-foreground mb-3 px-3 text-xs font-medium tracking-wider uppercase">
        Admin
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
