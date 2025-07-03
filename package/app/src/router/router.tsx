import { Route, Router, Switch } from "wouter";
import { ThemeProvider } from "@mui/material";

// Pages
import { Home } from "@/page/Home";
import { Login } from "@/page/Auth/Login";
import { NotFound } from "@/page/NotFound";

// Book – Read
import { BookReadChapterPage } from "@/page/Book/BookReadChapterPage";
import { BookReadLayout } from "@/layout/BookReadLayout";

// Book – Edit
import { BookEditLayout } from "@/layout/BookEditLayout";
import { BookEditMainPage } from "@/page/Book/BookEditMainPage";
import { BookEditChapterPage } from "@/page/Book/BookEditChapterPage";

// Book list / Library pages
import { BookLib } from "@/page/Book/BookLibPage";
import { BookDetail } from "@/page/Book/BookPage";
import { BookListPage } from "@/page/BookList/BookListPage";

// Misc
import TestPage from "@/page/Test/TestPage";
import { MainLayout } from "@/layout/MainLayout";

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
        <Route path="/book/:id/read/:chapterId">
          {() => (
            <BookReadLayout>
              <BookReadChapterPage />
            </BookReadLayout>
          )}
        </Route>

        {/* Book Edit (chapter first, then main) */}
        <Route path="/book/:id/edit/:chapterId">
          {() => (
            <BookEditLayout>
              <BookEditChapterPage />
            </BookEditLayout>
          )}
        </Route>
        <Route path="/book/:id/edit">
          {() => (
            <BookEditLayout>
              <BookEditMainPage />
            </BookEditLayout>
          )}
        </Route>

        {/* Main site area – all share MainLayout */}
        <Route path="/books">
          <MainLayout>
            <BookLib />
          </MainLayout>
        </Route>
        <Route path="/book/:id">
          {() => (
            <MainLayout>
              <BookDetail />
            </MainLayout>
          )}
        </Route>
        <Route path="/booklist/:id">
          {() => (
            <MainLayout>
              <BookListPage />
            </MainLayout>
          )}
        </Route>
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
          <MainLayout>
            <NotFound />
          </MainLayout>
        </Route>
      </Switch>
    </ThemeProvider>
  </Router>
);
