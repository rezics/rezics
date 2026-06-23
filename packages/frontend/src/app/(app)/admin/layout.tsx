import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  { href: "/admin/stats", label: "Dashboard" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/realms", label: "Realms" },
  { href: "/admin/books", label: "Books" },
  { href: "/admin/tags", label: "Tags" },
  { href: "/admin/governance", label: "Governance" },
] as const;

export default function AdminLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex gap-8">
      <nav className="hidden w-48 shrink-0 lg:block">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Admin</h2>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.href}>
              <Link
                className="text-muted-foreground hover:text-foreground block rounded-md px-3 py-2 text-sm"
                href={s.href}
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
