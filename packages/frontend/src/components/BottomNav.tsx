"use client";

import { BookOpenIcon, CompassIcon, BellIcon, UserIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", icon: BookOpenIcon, label: "Home" },
  { href: "/search", icon: SearchIcon, label: "Search" },
  { href: "/create", icon: CompassIcon, label: "Explore" },
  { href: "/inbox", icon: BellIcon, label: "Inbox" },
  { href: "/user/me", icon: UserIcon, label: "Me" },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="border-border bg-background fixed inset-x-0 bottom-0 z-40 border-t md:hidden">
      <div className="flex h-14 items-center justify-around">
        {items.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href;
          return (
            <Link
              className={`flex flex-col items-center gap-0.5 text-xs ${isActive ? "text-primary" : "text-muted-foreground"}`}
              href={href}
              key={href}
            >
              <Icon className="size-5" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
