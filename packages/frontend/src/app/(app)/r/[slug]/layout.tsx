import { RealmDetailContent } from "./content";
import type { ReactNode } from "react";

/**
 * Realm layout — shared header (icon, name, slug, join/leave) and tab navigation.
 * Realm 布局 — 共享页头（图标、名称、slug、加入/离开）和 tab 导航。
 *
 * Server component that delegates rendering to the client RealmDetailContent.
 * 服务端组件，将渲染委托给客户端 RealmDetailContent。
 */
export default async function RealmLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  return <RealmDetailContent slug={slug}>{children}</RealmDetailContent>;
}
