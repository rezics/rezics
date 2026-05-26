import { useRouterState } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { EditConsoleLayout } from "@/core/layouts/EditConsoleLayout";
import { Route as bookEditLayoutRoute } from "@/routes/_editor/book/$bookId/edit/route";
import { BookEditChapterContext } from "./BookEditChapterContext";
import {
  createBookEditConsoleConfig,
  getBookEditChapterContextId,
} from "./bookEditConsoleConfig";

export interface BookEditLayoutProps {
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
  const { bookId } = bookEditLayoutRoute.useParams();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const chapterId = getBookEditChapterContextId(pathname, bookId);

  return (
    <EditConsoleLayout
      {...createBookEditConsoleConfig(bookId)}
      sidebarId="book-edit-sidebar"
      contextSlot={
        chapterId ? (
          <BookEditChapterContext bookId={bookId} chapterId={chapterId} />
        ) : null
      }
    >
      {children}
    </EditConsoleLayout>
  );
};
