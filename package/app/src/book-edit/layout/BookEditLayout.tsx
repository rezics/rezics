import type React from "react";
import type { ReactNode } from "react";
import { LinearChapterList } from "@/book-library/component/Chapter/LinearChapterList";
import { Header } from "@/core/component/header/MainLayoutHeader.tsx";
import { Sidebar } from "@/core/component/sidebar/MainLayoutSidebar.tsx";
import { useLayoutStore } from "@/core/state/layoutStore.ts";
import { useMatch } from "@tanstack/react-router";
import { bookEditChapterRoute, bookEditLayoutRoute } from "@/router";
import { NAVIGATION } from "./BookEditorNavigation";

export interface BookEditLayoutProps {
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
  const bookId: string | undefined = bookEditLayoutRoute.useParams().bookId;
  const chapterMatch = useMatch({
    from: bookEditChapterRoute.id,
    shouldThrow: false,
  });
  const chapterId: string | undefined = chapterMatch?.params.chapterId;

  // UI state
  const { sidebarHeightBelow } = useLayoutStore();

  return (
    <div className="flex min-h-screen">
      <Header />
      <div id="book-edit-sidebar">
        <Sidebar NAVIGATION={NAVIGATION(bookId || "")}>
          <LinearChapterList
            bookId={bookId || ""}
            chapterId={chapterId || ""}
            height={sidebarHeightBelow + 50}
          />
        </Sidebar>
      </div>

      <main className="flex-grow pt-16 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
