import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { RealmDetailContent } from "./content";
import type { ReactNode } from "react";

/**
 * Realm layout — shared header (icon, name, slug, join/leave) and tab navigation.
 * Realm 布局 — 共享页头（图标、名称、slug、加入/离开）和 tab 导航。
 *
 * Server component wraps client content in SectionBoundary + ClientOnly
 * to prevent SSR prerendering of atom-based components.
 */
export default async function RealmLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return (
    <SectionBoundary>
      <ClientOnly>
        <RealmDetailContent slug={slug}>{children}</RealmDetailContent>
      </ClientOnly>
    </SectionBoundary>
  );
}
