import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "/inbox/notifications", label: "Notifications" },
  { href: "/inbox/conversations", label: "Messages" },
] as const;

export default function InboxLayout({ children }: { readonly children: ReactNode }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Inbox</h1>
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm font-medium"
            href={tab.href}
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
