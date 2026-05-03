import type { NavigationItem } from "@/core/components/navigation/navigation";
import { LayoutDashboard as DashboardIcon, FileText as DescriptionIcon } from "lucide-react";

// segment: router path

export const NAVIGATION = (bookId: string): NavigationItem[] => [
  {
    kind: "item",
    title: "Back to Book",
    segment: `/book/${bookId}`,
    icon: DashboardIcon,
  },

  {
    kind: "item",
    title: "Book Edit Main",
    segment: `/book/${bookId}/edit`,
    icon: DescriptionIcon,
  },
  {
    kind: "item",
    title: "Book Edit Tag",
    segment: `/book/${bookId}/edit/tag`,
    icon: DescriptionIcon,
  },
  {
    kind: "item",
    title: "Book Edit Chapter",
    segment: `/book/${bookId}/edit/chapter/`,
    icon: DescriptionIcon,
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
