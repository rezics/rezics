import type { ReactNode } from "react";
import { BookLayoutShell } from "./layout-shell";

/**
 * Mobile (<640px):
 * +-----------------------------+
 * | [Cover 120x160]             |
 * | Book Title                  |
 * | Author Name · Status        |
 * |-----------------------------|
 * | [Content|Discussion|Review] |
 * |  ^tabs, overflow-x-auto    |
 * |-----------------------------|
 * | {children}                  |
 * +-----------------------------+
 * w-full, cover + info stacked.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | [Cover] Book Title                   |
 * | 120x160 Author Name · Status         |
 * |        [Shelf v] [Rate]              |
 * |--------------------------------------|
 * | [Content | Discussion | Reviews | Info]
 * |--------------------------------------|
 * | {children}                           |
 * +--------------------------------------+
 * max-w-3xl mx-auto，cover 与信息横排。
 *
 * Desktop (1024-1535px):
 * +------------------------------------------+
 * | [Cover] Book Title                       |
 * | 120x160 Author Name · Published · Rating |
 * |        [Add to Shelf v] [Rate] [Share]   |
 * |------------------------------------------|
 * | [Content | Discussion | Reviews | Info ] |
 * |------------------------------------------|
 * | {children}                               |
 * +------------------------------------------+
 * max-w-3xl mx-auto。
 *
 * Ultra-wide (>=1536px): 与 Desktop 一致。
 *
 * 书籍详情布局：封面 + 元数据 + tabs + 子页面。
 * tabs 高亮当前路由。
 */
export default async function BookLayout({
  children,
  params,
}: {
  readonly children: ReactNode;
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <BookLayoutShell bookId={id}>{children}</BookLayoutShell>
    </div>
  );
}
