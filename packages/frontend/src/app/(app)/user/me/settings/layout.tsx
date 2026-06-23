import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  { href: "/user/me/settings/account", label: "Account" },
  { href: "/user/me/settings/security", label: "Security" },
  { href: "/user/me/settings/preferences", label: "Preferences" },
  { href: "/user/me/settings/notifications", label: "Notifications" },
  { href: "/user/me/settings/connections", label: "Connections" },
  { href: "/user/me/settings/library", label: "Library" },
  { href: "/user/me/settings/tokens", label: "API Tokens" },
] as const;

export default function SettingsLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="flex gap-8">
      <nav className="hidden w-48 shrink-0 md:block">
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
