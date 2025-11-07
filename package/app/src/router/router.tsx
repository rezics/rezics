import {ThemeProvider} from '@mui/material';
import {Route, Router, Switch} from 'wouter';

// Pages
import {LoginPage} from '@/page/Auth/LoginPage.tsx';
import {RegisterPage} from '@/page/Auth/RegisterPage.tsx';
import {HomeContainer} from '@/page/Home.tsx';
import {NotFoundContainer} from '@/page/NotFound.tsx';

// Book – Read
import {BookReadLayout} from '@/layout/BookReadLayout.tsx';
import {BookReadChapterPage} from '@/page/Book/ChapterPage.tsx';

// Book – Edit
import {BookEditLayout} from '@/layout/BookEditLayout.tsx';
import {BookEditChapterPage} from '@/page/BookEdit/ChapterPage.tsx';
import {BookEditMainPage} from '@/page/BookEdit/InfoPage.tsx';

// Book list / Library pages
import {BookLibContainer} from '@/page/Book/BookLibPage.tsx';
import {BookPageContainer} from '@/page/Book/BookPage.tsx';
import {ReadListPage} from '@/page/ReadList/ReadListPage.tsx';

// Tag pages
import {TagByBookPage, TagByBookFullPage} from '@/page/Tag/TagByUnitPage';
import {TagDomainPage} from '@/page/Tag/TagDomain';
import {TagUnitPage} from '@/page/Tag/TagUnitPage';

// User pages
import {UserEditPage} from '@/page/User/UserEditPage.tsx';

// Misc
import {MainLayout} from '@/layout/MainLayout.tsx';
import {BookListEditPage} from '@/page/ReadList/ReadListEditPage.tsx';
import {ReadlistByBookPage} from '@/page/ReadList/ReadListsByBookPage.tsx';
import {QuoteByBookPage} from '@/page/Review/QuoteByBookPage.tsx';
import {ReviewByBookPage} from '@/page/Review/ReviewByBookPage.tsx';
import {LongReviewEditPage} from '@/page/Review/ReviewEditPage.tsx';
import {ShortReviewByBookPage} from '@/page/Review/ShortReviewByBookPage.tsx';
import TestPage from '@/page/Test/TestPage.tsx';
import {TestPage02} from '@/page/Test/TestPage02.tsx';
import {TestPage03} from '@/page/Test/TestPage03.tsx';
// import TestPaginationPage from "@/page/Test/TestPaginationPage.tsx";
// import {NewBookPage} from '@/page/BookEdit/NewBookPage.tsx';
import {MainConfigPage} from '@/page/Config/MainConfigPage';
import {UserPage} from '@/page/User/UserPage.tsx';

// TODO 删除 ThemeProvider

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
        <Route path="/login">
          <LoginPage />
        </Route>
        <Route path="/register">
          <RegisterPage />
        </Route>

        {/* ANCHOR Book Read – keep the more specific path first */}
        <Route path="/book/:bookId/read/:chapterId">
          {({bookId, chapterId}) => (
            <BookReadLayout bookId={bookId} chapterId={chapterId}>
              <BookReadChapterPage chapterId={chapterId} />
            </BookReadLayout>
          )}
        </Route>

        {/* ANCHOR Book Edit (chapter first, then main) */}
        {/* <Route path="/book/new">
          <MainLayout>
            <NewBookPage />
          </MainLayout>
        </Route> */}
        <Route path="/book/:bookId/edit/:chapterId">
          {({bookId, chapterId}) => (
            <BookEditLayout bookId={bookId} chapterId={chapterId}>
              <BookEditChapterPage chapterId={chapterId} />
            </BookEditLayout>
          )}
        </Route>
        <Route path="/book/:bookId/edit">
          {({bookId}) => (
            <BookEditLayout bookId={bookId}>
              <BookEditMainPage bookId={bookId} />
            </BookEditLayout>
          )}
        </Route>

        {/* ANCHOR Book Info Routes */}
        <Route path="/books">
          <MainLayout>
            <BookLibContainer />
          </MainLayout>
        </Route>
        <Route path="/book/:bookId">
          {({bookId}) => (
            <MainLayout>
              <BookPageContainer bookId={bookId} />
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
        <Route path="/tag/domain/:unitId">
          {({unitId}) => (
            <MainLayout>
              <TagDomainPage unitId={unitId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/domain/:unitId/title/:title">
          {({unitId, title}) => (
            <MainLayout>
              <TagDomainPage unitId={unitId} title={title} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/:unitId">
          {({unitId}) => (
            <MainLayout>
              <TagUnitPage unitId={unitId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/book/:bookId">
          {({bookId}) => (
            <MainLayout>
              <TagByBookPage bookId={bookId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/book/:bookId/tags">
          {({bookId}) => (
            <MainLayout>
              <TagByBookFullPage bookId={bookId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/book/:bookId/tags/:domainId">
          {({bookId, domainId}) => (
            <MainLayout>
              <TagByBookFullPage bookId={bookId} domainId={domainId} />
            </MainLayout>
          )}
        </Route>

        {/* ANCHOR User Routes */}
        <Route path="/user/me/edit">
          <MainLayout>
            <UserEditPage />
          </MainLayout>
        </Route>
        <Route path="/user/me">
          <MainLayout>
            <UserPage isCurrentUser={true} />
          </MainLayout>
        </Route>
        <Route path="/user/:unitId">
          {({unitId}) => (
            <MainLayout>
              <UserPage unitId={unitId} />
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
          <TestPage03 />
          {/* <BookEditLayout>
                    </BookEditLayout> */}
        </Route>
        {/* <Route path="/test04">
                    <MainLayout>
                        <TestPaginationPage />
                    </MainLayout>
                </Route> */}
        {/* ANCHOR Home */}
        <Route path="/">
          <MainLayout>
            <HomeContainer />
          </MainLayout>
        </Route>

        {/* ANCHOR404 fallback */}
        <Route>
          <NotFoundContainer />
        </Route>
      </Switch>
    </ThemeProvider>
  </Router>
);
