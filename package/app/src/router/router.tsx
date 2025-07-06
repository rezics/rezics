import { Route, Router, Switch } from "wouter";
import { ThemeProvider } from "@mui/material";

// Pages
import { Home } from "@/page/Home";
import { Login } from "@/page/Auth/Login";
import { NotFound } from "@/page/NotFound";

// Book – Read
import { BookReadChapterPage } from "@/page/Book/ChapterPage";
import { BookReadLayout } from "@/layout/BookReadLayout";

// Book – Edit
import { BookEditLayout } from "@/layout/BookEditLayout";
import { BookEditMainPage } from "@/page/BookEdit/InfoPage";
import { BookEditChapterPage } from "@/page/BookEdit/ChapterPage";

// Book list / Library pages
import { BookLib } from "@/page/Book/BookLibPage";
import { BookDetail } from "@/page/Book/BookPage";
import { BookListPage } from "@/page/ReadList/ReadListPage";

// Misc
import TestPage from "@/page/Test/TestPage";
import { MainLayout } from "@/layout/MainLayout";
import { BookListEditPage } from "@/page/ReadList/ReadListEditPage";
import { BookCollectionListPage } from "@/page/ReadList/ReadListsPage";
import { ShortReviewPage } from "@/page/Review/ShortReviewPage";
import { LongReviewPage } from "@/page/Review/ReviewPage";
import { LongReviewEditPage } from "@/page/Review/ReviewEditPage";

/**
 * IMPORTANT – Flattened routing
 * Each <Route> is now a direct child of <Switch>.
 * We wrap the actual page inside the desired Layout **inside** the render
 * callback, so <Switch> can correctly evaluate the path instead of matching
 * an always-truthy Layout component first.
 */
export default (
  <Router>
    <ThemeProvider theme={{}}>
      <Switch>
        {/* Auth */}
        <Route path="/login" component={Login} />
        <Route path="/register" component={Login} />

        {/* Book Read – keep the more specific path first */}
        <Route path="/book/:bookId/read/:chapterId">
          {() => (
            <BookReadLayout>
              <BookReadChapterPage />
            </BookReadLayout>
          )}
        </Route>

        {/* Book Edit (chapter first, then main) */}
        <Route path="/book/:bookId/edit/:chapterId">
          {() => (
            <BookEditLayout>
              <BookEditChapterPage />
            </BookEditLayout>
          )}
        </Route>
        <Route path="/book/:bookId/edit">
          {() => (
            <BookEditLayout>
              <BookEditMainPage />
            </BookEditLayout>
          )}
        </Route>

        {/* Book Info Routes */}
        <Route path="/books">
          <MainLayout>
            <BookLib />
          </MainLayout>
        </Route>
        <Route path="/book/:bookId">
          {() => (
            <MainLayout>
              <BookDetail />
            </MainLayout>
          )}
        </Route>

        {/* Review Routes */}
        <Route path="/review/short/book/:bookId">
          {() => (
            <MainLayout>
              <ShortReviewPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/review/long/book/:bookId">
          {() => (
            <MainLayout>
              <LongReviewPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/review/long/book/:bookId/edit">
          {() => (
            <MainLayout>
              <LongReviewEditPage />
            </MainLayout>
          )}
        </Route>

        {/* BookList Routes */}
        <Route path="/booklist/:booklistId">
          {() => (
            <MainLayout>
              <BookListPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/booklist/:booklistId/edit">
          {() => (
            <MainLayout>
              <BookListEditPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/booklist/book/:bookId">
          {() => (
            <MainLayout>
              <BookCollectionListPage />
            </MainLayout>
          )}
        </Route>

        {/* Test */}
        <Route path="/test">
          <MainLayout>
            <TestPage />
          </MainLayout>
        </Route>

        {/* Home */}
        <Route path="/">
          <MainLayout>
            <Home />
          </MainLayout>
        </Route>

        {/* 404 fallback */}
        <Route>
            <NotFound />
        </Route>
      </Switch>
    </ThemeProvider>
  </Router>
);
