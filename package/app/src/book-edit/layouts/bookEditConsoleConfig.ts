import {
  FileText as DescriptionIcon,
  History as HistoryIcon,
  LayoutDashboard as DashboardIcon,
  ShieldCheck as AuthorityIcon,
} from "lucide-react";
import type { EditConsoleLayoutProps } from "@/core/layouts/EditConsoleLayout";
import {
  book_edit_sidebar_authority,
  book_edit_sidebar_back_to_book,
  book_edit_sidebar_chapters,
  book_edit_sidebar_history,
  book_edit_sidebar_main,
  book_edit_sidebar_tags,
} from "@rezics/i18n/messages";

const BOOK_EDIT_RESERVED_SEGMENTS = new Set([
  "authority",
  "chapter",
  "history",
  "tag",
]);

function normalizePath(value: string) {
  const normalized = value.startsWith("/") ? value : `/${value}`;
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

export function getBookEditChapterContextId(
  pathname: string,
  bookId: string,
): string | null {
  const editBase = normalizePath(`/book/${bookId}/edit`);
  const normalizedPathname = normalizePath(pathname);
  const prefix = `${editBase}/`;

  if (!normalizedPathname.startsWith(prefix)) return null;

  const rest = normalizedPathname.slice(prefix.length);
  if (!rest || rest.includes("/")) return null;
  if (BOOK_EDIT_RESERVED_SEGMENTS.has(rest)) return null;

  return decodeURIComponent(rest);
}

export function createBookEditConsoleConfig(
  bookId: string,
): Pick<
  EditConsoleLayoutProps,
  "returnItem" | "primaryItems" | "operationalItems"
> {
  const bookBase = `/book/${bookId}`;
  const editBase = `${bookBase}/edit`;

  return {
    returnItem: {
      label: book_edit_sidebar_back_to_book(),
      href: bookBase,
      icon: DashboardIcon,
    },
    primaryItems: [
      {
        label: book_edit_sidebar_main(),
        href: editBase,
        icon: DescriptionIcon,
      },
      {
        label: book_edit_sidebar_tags(),
        href: `${editBase}/tag`,
        icon: DescriptionIcon,
      },
      {
        label: book_edit_sidebar_chapters(),
        href: `${editBase}/chapter`,
        icon: DescriptionIcon,
        isActive: (pathname) =>
          normalizePath(pathname) === `${editBase}/chapter` ||
          getBookEditChapterContextId(pathname, bookId) !== null,
      },
    ],
    operationalItems: [
      {
        label: book_edit_sidebar_authority(),
        href: `${editBase}/authority`,
        icon: AuthorityIcon,
      },
      {
        label: book_edit_sidebar_history(),
        href: `${editBase}/history`,
        icon: HistoryIcon,
        activeMatch: "prefix",
      },
    ],
  };
}
