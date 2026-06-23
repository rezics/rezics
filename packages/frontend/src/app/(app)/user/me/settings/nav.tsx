"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";

const sections = [
  { href: "/user/me/settings/account", key: "account" },
  { href: "/user/me/settings/security", key: "security" },
  { href: "/user/me/settings/preferences", key: "preferences" },
  { href: "/user/me/settings/notifications", key: "notifications" },
  { href: "/user/me/settings/connections", key: "connections" },
  { href: "/user/me/settings/library", key: "library" },
  { href: "/user/me/settings/tokens", key: "tokens" },
] as const;

const labels: Record<string, string> = {
  account: "Account",
  security: "Security",
  preferences: "Preferences",
  notifications: "Notifications",
  connections: "Connections",
  library: "Library",
  tokens: "API Tokens",
};

export function SettingsNav() {
  const pathname = usePathname();

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
                {labels[s.key]}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
