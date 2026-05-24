import * as m from "@rezics/i18n/messages";
import { Button, Separator } from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { LinearChapterList } from "@/book-library/components/Chapter/LinearChapterList";
import { Header } from "@/core/components/header/MainLayoutHeader";
import { Sidebar } from "@/core/components/sidebar/MainLayoutSidebar";
import { useLayoutStore } from "@/core/states/layoutStore.ts";
import { Route as bookReadLayoutRoute } from "@/routes/book_/$bookId/read/$chapterId/route";
export interface BookReadLayoutProps {
  children: ReactNode;
}

export const BookReadLayout: React.FC<BookReadLayoutProps> = ({ children }) => {
  const navigate = useNavigate();
  const { bookId, chapterId } = bookReadLayoutRoute.useParams();
  const { sidebarHeightBelow } = useLayoutStore();

  return (
    <div className="flex min-h-screen">
      <Header />

      <div>
        <Sidebar NAVIGATION={[]} sidebarHeaderClassName="mx-8">
          <div>
            <div className="flex items-center justify-between mb-2 bg-gray-50 text-sm text-gray-800">
              <div className="font-medium">{m.book_toc()}</div>
              <Button
                variant="ghost"
                onClick={() => {
                  navigate({ to: `/book/${bookId}/` });
                }}
              >
                {m.book_read_back_to_book()}
              </Button>
            </div>
            <Separator className="mb-4" />
            <LinearChapterList
              bookId={bookId || ""}
              chapterId={chapterId || ""}
              height={sidebarHeightBelow}
            />
          </div>
        </Sidebar>
      </div>

      <main className="flex-grow pt-32 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
