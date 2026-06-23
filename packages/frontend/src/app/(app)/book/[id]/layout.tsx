import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "", label: "Content" },
  { href: "/discussion", label: "Discussion" },
  { href: "/review", label: "Reviews" },
  { href: "/info", label: "Info" },
] as const;

export default async function BookLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm font-medium"
            href={`/book/${id}${tab.href}`}
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
