import type React from "react";
import type { ReactNode } from "react";
import { Header } from "@/core/component/header/MainLayoutHeader.tsx";
import { Sidebar } from "@/core/component/sidebar/MainLayoutSidebar.tsx";
import { bookEditLayoutRoute } from "@/router";
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
        className="flex-grow pt-16 transition-all duration-300"
        style={{ backgroundColor: "var(--mui-palette-background-default)" }}
      >
        {children}
      </main>
    </div>
  );
};
