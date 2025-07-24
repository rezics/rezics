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
import { BookPage } from "@/page/Book/BookPage";
import { ReadListPage } from "@/page/ReadList/ReadListPage";

// Misc
import TestPage from "@/page/Test/TestPage";
import { MainLayout } from "@/layout/MainLayout";
import { BookListEditPage } from "@/page/ReadList/ReadListEditPage";
import { ReadlistByBookPage } from "@/page/ReadList/ReadListsByBookPage";
import { ShortReviewByBookPage } from "@/page/Review/ShortReviewByBookPage";
import { ReviewByBookPage } from "@/page/Review/ReviewByBookPage";
import { LongReviewEditPage } from "@/page/Review/ReviewEditPage";
import { QuoteByBookPage } from "@/page/Review/QuoteByBookPage";
import { TestPage02 } from "@/page/Test/TestPage02";
import { TestPage03 } from "@/page/Test/TestPage03";
import { TagByBookPage } from "@/page/Tag/TagByBookPage";
import TestPaginationPage from "@/page/Test/TestPaginationPage";
import { NewBookPage } from "@/page/BookEdit/NewBookPage";
import { UserPage } from "@/page/User/UserPage";

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
                {/* ANCHOR Auth */}
                <Route path="/login" component={Login.Container} />
                <Route path="/register" component={Login.Container} />

                {/* ANCHOR Book Read – keep the more specific path first */}
                <Route path="/book/:bookId/read/:chapterId">
                    {() => (
                        <BookReadLayout>
                            <BookReadChapterPage />
                        </BookReadLayout>
                    )}
                </Route>

                {/* ANCHOR Book Edit (chapter first, then main) */}
                <Route path="/book/new">
                    <MainLayout>
                        <NewBookPage />
                    </MainLayout>
                </Route>
                <Route path="/book/:bookId/edit/:chapterId">
                    {({ chapterId }) => (
                        <BookEditLayout>
                            <BookEditChapterPage chapterId={chapterId} />
                        </BookEditLayout>
                    )}
                </Route>
                <Route path="/book/:bookId/edit">
                    {({ bookId }) => (
                        <BookEditLayout>
                            <BookEditMainPage bookId={bookId} />
                        </BookEditLayout>
                    )}
                </Route>

                {/* ANCHOR Book Info Routes */}
                <Route path="/books">
                    <MainLayout>
                        <BookLib.Container />
                    </MainLayout>
                </Route>
                <Route path="/book/:bookId">
                    {({ bookId }) => (
                        <MainLayout>
                            <BookPage.Container bookId={bookId} />
                        </MainLayout>
                    )}
                </Route>

                {/* ANCHOR Review Routes */}
                <Route path="/review/short/book/:bookId">
                    {() => (
                        <MainLayout>
                            <ShortReviewByBookPage />
                        </MainLayout>
                    )}
                </Route>
                <Route path="/review/book/:bookId">
                    {() => (
                        <MainLayout>
                            <ReviewByBookPage />
                        </MainLayout>
                    )}
                </Route>
                <Route path="/review/book/:bookId/edit">
                    {() => (
                        <MainLayout>
                            <LongReviewEditPage />
                        </MainLayout>
                    )}
                </Route>

                {/* ANCHOR Quote Routes */}
                <Route path="/quote/book/:bookId">
                    {() => (
                        <MainLayout>
                            <QuoteByBookPage />
                        </MainLayout>
                    )}
                </Route>

                {/* ANCHOR ReadList Routes */}
                <Route path="/readlist/:readlistId">
                    {() => (
                        <MainLayout>
                            <ReadListPage />
                        </MainLayout>
                    )}
                </Route>
                <Route path="/readlist/:readlistId/edit">
                    {() => (
                        <MainLayout>
                            <BookListEditPage />
                        </MainLayout>
                    )}
                </Route>
                <Route path="/readlist/book/:bookId">
                    {() => (
                        <MainLayout>
                            <ReadlistByBookPage />
                        </MainLayout>
                    )}
                </Route>

                {/* ANCHOR Tag Routes */}
                <Route path="/tag/book/:bookId">
                    {({ bookId }) => (
                        <MainLayout>
                            <TagByBookPage bookId={bookId} />
                        </MainLayout>
                    )}
                </Route>

                {/* AHCHOR User Routes */}
                <Route path="/user/:userId">
                    {({ userId }) => (
                        <MainLayout>
                            <UserPage userId={userId} />
                        </MainLayout>
                    )}
                </Route>

                {/* ANCHOR Test */}
                <Route path="/test">
                    <MainLayout>
                        <TestPage />
                    </MainLayout>
                </Route>
                <Route path="/test02">
                    <MainLayout>
                        <TestPage02 />
                    </MainLayout>
                </Route>
                <Route path="/test03">
                    <BookEditLayout>
                        <TestPage03 />
                    </BookEditLayout>
                </Route>
                <Route path="/test04">
                    <MainLayout>
                        <TestPaginationPage />
                    </MainLayout>
                </Route>
                {/* ANCHOR Home */}
                <Route path="/">
                    <MainLayout>
                        <Home.Container />
                    </MainLayout>
                </Route>

                {/* ANCHOR404 fallback */}
                <Route>
                    <NotFound.Container />
                </Route>
            </Switch>
        </ThemeProvider>
    </Router>
);
