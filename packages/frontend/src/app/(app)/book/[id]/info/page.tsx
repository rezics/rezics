"use client";

import { bookQuery } from "@/atoms/books";
import { ClientOnly } from "@/components/ClientOnly";
import { SectionBoundary } from "@/components/SectionBoundary";
import { useT } from "@/lib/i18n/locale";
import { useAtomSuspense } from "@effect/atom-react";
import type { BookDTO } from "@rezics/backend/api";
import { useParams } from "next/navigation";

function InfoRow({
  label,
  value,
}: {
  readonly label: string;
  readonly value: string;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-3">
      <dt className="text-muted-foreground w-28 shrink-0 text-sm font-medium">{label}</dt>
      <dd className="min-w-0 text-sm break-all">{value}</dd>
    </div>
  );
}

export function BookInfoView({ book }: { readonly book: BookDTO }) {
  const [t] = useT();

  return (
    <dl className="space-y-3">
      <InfoRow label={t.book.isbn} value={book.isbn13 ?? t.book.noIsbn} />
      <InfoRow
        label={t.book.pageCount}
        value={book.pageCount != null ? t.book.pages(book.pageCount) : t.book.noIsbn}
      />
      <InfoRow label={t.book.textLength} value={t.book.characters(book.textLength)} />
      <InfoRow label={t.book.chapter} value={t.book.chapters(book.chapterCount)} />
      <InfoRow label={t.book.status} value={book.status} />
      <InfoRow label={t.book.visibility} value={book.visibility} />
      <InfoRow label={t.book.created} value={new Date(book.createdAt).toLocaleDateString()} />
      <InfoRow label={t.book.updated} value={new Date(book.updatedAt).toLocaleDateString()} />
    </dl>
  );
}

function BookInfoInner({ bookId }: { readonly bookId: string }) {
  const result = useAtomSuspense(bookQuery(bookId));

  return <BookInfoView book={result.value} />;
}

/**
 * Book info page showing metadata (ISBN, page count, status, etc.).
 * 书籍详情页面，展示元数据（ISBN、页数、状态等）。
 *
 * ```
 * Mobile (<640px):
 * +----------------------------+
 * | ISBN                       |
 * | 978-0-123456-78-9          |
 * |                            |
 * | Pages                      |
 * | 320 pages                  |
 * |                            |
 * | Text Length                 |
 * | 142,000 characters         |
 * |                            |
 * | Status                     |
 * | PUBLISHED                  |
 * +----------------------------+
 * w-full. Label and value stacked vertically on mobile.
 *
 * Tablet (640-1023px):
 * +--------------------------------------+
 * | ISBN           978-0-123456-78-9     |
 * | Pages          320 pages             |
 * | Text Length    142,000 characters    |
 * | Status         PUBLISHED             |
 * | Visibility     PUBLIC                |
 * | Created        2025-01-15            |
 * | Last Updated   2025-03-20            |
 * +--------------------------------------+
 * Label (w-28, shrink-0) and value on same row.
 *
 * Desktop (1024-1535px):
 * +--------------------------------------+
 * | ISBN           978-0-123456-78-9     |
 * | Pages          320 pages             |
 * | Text Length    142,000 characters    |
 * | Status         PUBLISHED             |
 * | Visibility     PUBLIC                |
 * | Created        2025-01-15            |
 * | Last Updated   2025-03-20            |
 * +--------------------------------------+
 * Same as Tablet. Parent caps max-w-3xl.
 *
 * Ultra-wide (>=1536px):
 * Same as Desktop. Parent caps max-w-3xl.
 * ```
 *
 * 窄端（<640px）：标签与值垂直堆叠。
 * 宽端（>=640px）：标签（固定 w-28）与值同行，值 break-all 防溢出。
 * 空值显示"Not available"占位。
 */
export default function BookInfoPage() {
  const { id } = useParams<{ id: string }>();

  return (
    <div className="py-4">
      <ClientOnly>
        <SectionBoundary>
          <BookInfoInner bookId={id} />
        </SectionBoundary>
      </ClientOnly>
    </div>
  );
}
