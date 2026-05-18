import type React from "react";
import type { ReactNode } from "react";
import { Header } from "@/core/components/header/MainLayoutHeader.tsx";
import { Sidebar } from "@/core/components/sidebar/MainLayoutSidebar.tsx";
import { Route as bookEditLayoutRoute } from "@/routes/book_/$bookId/edit/route";
import { NAVIGATION } from "./BookEditorNavigation";

export interface BookEditLayoutProps {
  children: ReactNode;
}

export const BookEditLayout: React.FC<BookEditLayoutProps> = ({ children }) => {
  const bookId: string | undefined = bookEditLayoutRoute.useParams().bookId;

  return (
    <div className="flex min-h-screen">
      <Header />
      <div id="book-edit-sidebar">
        <Sidebar NAVIGATION={NAVIGATION(bookId || "")} />
      </div>

      <main
        className="flex-grow pt-32 transition-all duration-300"
        style={{ backgroundColor: "var(--colors-surface-canvas)" }}
      >
        {children}
      </main>
    </div>
  );
};
