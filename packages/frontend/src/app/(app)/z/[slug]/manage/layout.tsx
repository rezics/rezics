import Link from "next/link";
import type { ReactNode } from "react";

const sections = [
  { suffix: "profile", label: "Profile" },
  { suffix: "theme", label: "Theme" },
  { suffix: "pages", label: "Pages" },
  { suffix: "menus", label: "Menus" },
] as const;

export default async function ManageZoneLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <div className="flex gap-8">
      <nav className="hidden w-44 shrink-0 md:block">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider">Manage Zone</h2>
        <ul className="space-y-1">
          {sections.map((s) => (
            <li key={s.suffix}>
              <Link
                className="text-muted-foreground hover:text-foreground block rounded-md px-3 py-2 text-sm"
                href={`/z/${slug}/manage/${s.suffix}`}
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
