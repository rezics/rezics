"use client";

import { useT } from "@/lib/i18n/locale";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

export function SettingsNav() {
  const pathname = usePathname();
  const [t] = useT();

  const sections = [
    { href: "/user/me/settings/account", label: t.settings.account },
    { href: "/user/me/settings/security", label: t.settings.security },
    { href: "/user/me/settings/preferences", label: t.settings.preferences },
    { href: "/user/me/settings/notifications", label: t.settings.notifications },
    { href: "/user/me/settings/connections", label: t.settings.connections },
    { href: "/user/me/settings/library", label: t.settings.libraryPreferences },
    { href: "/user/me/settings/tokens", label: t.settings.tokens },
  ];

  return (
    <nav className="hidden w-48 shrink-0 md:block">
      <ul className="space-y-0.5">
        {sections.map((s) => {
          const isActive = pathname === s.href;
          return (
            <li key={s.href}>
              <Link
                className={cn(
                  "block rounded-md px-3 py-2 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium"
                    : "text-muted-foreground hover:text-foreground",
                )}
                href={s.href}
              >
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
