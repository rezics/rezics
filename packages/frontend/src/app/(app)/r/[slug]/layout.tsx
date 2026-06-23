import Link from "next/link";
import type { ReactNode } from "react";

const tabs = [
  { href: "", label: "Posts" },
  { href: "/shelves", label: "Shelves" },
  { href: "/tags", label: "Tags" },
  { href: "/wiki", label: "Wiki" },
  { href: "/rules", label: "Rules" },
] as const;

export default async function RealmLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{slug}</h1>
      </div>
      <nav className="border-border flex gap-1 border-b">
        {tabs.map((tab) => (
          <Link
            className="text-muted-foreground hover:text-foreground border-b-2 border-transparent px-3 py-2 text-sm font-medium"
            href={`/r/${slug}${tab.href}`}
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
