import { Button, Divider } from "@mui/material";
import { useNavigate } from "@tanstack/react-router";
import type React from "react";
import type { ReactNode } from "react";
import { LinearChapterList } from "@/book-library/component/Chapter/LinearChapterList";
import { Header } from "@/core/component/header/MainLayoutHeader";
import { Sidebar } from "@/core/component/sidebar/MainLayoutSidebar";
import { useLayoutStore } from "@/core/state/layoutStore.ts";
import { bookReadLayoutRoute } from "@/router";
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
        <Sidebar NAVIGATION={[]} sidebarHeaderClassName="mx-6">
          <div>
            <div className="flex items-center justify-between mb-2 bg-gray-50 text-sm text-gray-800">
              <div className="font-medium">目录</div>
              <Button
                variant="text"
                onClick={() => {
                  navigate({ to: `/book/${bookId}/` });
                }}
              >
                返回书籍
              </Button>
            </div>
            <Divider className="mb-4" />
            <LinearChapterList
              bookId={bookId || ""}
              chapterId={chapterId || ""}
              height={sidebarHeightBelow}
            />
          </div>
        </Sidebar>
      </div>

      <main className="flex-grow pt-16 transition-all duration-300">
        {children}
      </main>
    </div>
  );
};
