import {
  History as HistoryIcon,
  LayoutDashboard as DashboardIcon,
  FileText as DescriptionIcon,
  ShieldCheck as AuthorityIcon,
} from "lucide-react";
import * as m from "@rezics/i18n/messages";
import type { NavigationItem } from "@/core/components/navigation/navigation";

// segment: router path

export const NAVIGATION = (bookId: string): NavigationItem[] => [
  {
    kind: "item",
    title: m.book_edit_sidebar_back_to_book(),
    segment: `/book/${bookId}`,
    icon: DashboardIcon,
  },

  {
    kind: "item",
    title: m.book_edit_sidebar_main(),
    segment: `/book/${bookId}/edit`,
    icon: DescriptionIcon,
  },
  {
    kind: "item",
    title: m.book_edit_sidebar_tags(),
    segment: `/book/${bookId}/edit/tag`,
    icon: DescriptionIcon,
  },
  {
    kind: "item",
    title: m.book_edit_sidebar_chapters(),
    segment: `/book/${bookId}/edit/chapter/`,
    icon: DescriptionIcon,
  },
  {
    kind: "item",
    title: m.book_edit_sidebar_authority(),
    segment: `/book/${bookId}/edit/authority`,
    icon: AuthorityIcon,
  },
  {
    kind: "item",
    title: m.book_edit_sidebar_history(),
    segment: `/book/${bookId}/edit/history`,
    icon: HistoryIcon,
  },
  {
    kind: "divider",
  },
  // {
  //     kind: "header",
  //     title: "Chapter Navigation",
  // },
  // {
  //     kind: "item",
  //     segment: "~/book/1/edit/1",
  //     title: "Chapter 1",
  //     icon: <DescriptionIcon />,
  // },
];
