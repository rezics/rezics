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
import {NewBookPage} from '@/page/BookEdit/NewBookPage.tsx';
import {BookEditChapterListPage} from '@/page/BookEdit/ChapterListPage.tsx';

// Review pages
import {ReviewsPage} from '@/page/Review/ReviewsPage';
import {ReviewPage} from '@/page/Review/ReviewPage.tsx';
import {ReviewNewPage} from '@/page/Review/ReviewNewPage.tsx';
import {ReviewEditPageContainer} from '@/page/Review/ReviewEditPage.tsx';
import {QuoteByBookPage} from '@/page/Review/QuoteByBookPage.tsx';
import {QuotePage} from '@/page/Review/QuotePage.tsx';

// Library pages
import {BookLibContainer} from '@/page/Book/BookLibPage.tsx';
import {BookPageContainer} from '@/page/Book/BookPage.tsx';

// ReadList pages
import {ReadListPage} from '@/page/ReadList/ReadListPage.tsx';
import {ReadListsPage} from '@/page/ReadList/ReadListsPage.tsx';

// Unit pages
import {UnitsPage} from '@/page/Unit/UnitsPage.tsx';

// Tag pages
import {TagByBookPage, TagByBookFullPage} from '@/page/Tag/TagByUnitPage';
import {TagDomainPage} from '@/page/Tag/TagDomain';
import {TagUnitPage} from '@/page/Tag/TagUnitPage';

// User pages
import {UserEditPage} from '@/page/User/UserEditPage.tsx';
import {BookmarkPage} from '@/page/User/BookmarkPage.tsx';
import {FollowInfoPage} from '@/page/User/FollowInfoPage.tsx';

// Misc
import {MainLayout} from '@/layout/MainLayout.tsx';
import {ReadListEditPage} from '@/page/ReadList/ReadListEditPage.tsx';
import {NewReadListPage} from '@/page/ReadList/NewReadListPage.tsx';
import {ReadlistByBookPage} from '@/page/ReadList/ReadListsByBookPage.tsx';
import {ReviewByBookPage} from '@/page/Review/ReviewByBookPage.tsx';
import {ShortReviewByBookPage} from '@/page/Review/ShortReviewByBookPage.tsx';
import TestPage from '@/page/Test/TestPage.tsx';
import {TestPage02} from '@/page/Test/TestPage02.tsx';
import {TestPage03} from '@/page/Test/TestPage03.tsx';
// import TestPaginationPage from "@/page/Test/TestPaginationPage.tsx";
// import {NewBookPage} from '@/page/BookEdit/NewBookPage.tsx';
import {UserPage} from '@/page/User/UserPage.tsx';
import {NoticePage} from '@/page/Misc/Notice.tsx';
import {ReactionInfoPage} from '@/page/User/ReactionInfoPage.tsx';

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
          <MainLayout>
            <LoginPage />
          </MainLayout>
        </Route>
        <Route path="/register">
          <MainLayout>
            <RegisterPage />
          </MainLayout>
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
        <Route path="/book/new">
          <MainLayout>
            <NewBookPage />
          </MainLayout>
        </Route>
        <Route path="/book/:bookId/edit/chapter/">
          {({bookId}) => (
            <BookEditLayout bookId={bookId}>
              <BookEditChapterListPage bookId={bookId} />
            </BookEditLayout>
          )}
        </Route>
        <Route path="/book/:bookId/edit/chapter/:chapterId">
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
        <Route path="/book">
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
        <Route path="/review/">
          {() => (
            <MainLayout>
              <ReviewsPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/review/new/:bookUnitId">
          {({bookUnitId}) => (
            <MainLayout>
              <ReviewNewPage bookUnitId={bookUnitId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/review/:reviewId/edit">
          {({reviewId}) => (
            <MainLayout>
              <ReviewEditPageContainer reviewId={reviewId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/review/:reviewId">
          {({reviewId}) => (
            <MainLayout>
              <ReviewPage reviewId={reviewId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/remark/:reviewId">
          {({reviewId}) => (
            <MainLayout>
              <ReviewPage reviewId={reviewId} />
            </MainLayout>
          )}
        </Route>
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

        {/* ANCHOR Quote Routes */}
        <Route path="/quote/book/:bookId">
          {() => (
            <MainLayout>
              <QuoteByBookPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/quote/:unitId">
          {({unitId}) => (
            <MainLayout>
              <QuotePage unitId={unitId} />
            </MainLayout>
          )}
        </Route>

        {/* ANCHOR ReadList Routes */}
        <Route path="/readlist/new">
          <MainLayout>
            <NewReadListPage />
          </MainLayout>
        </Route>
        <Route path="/readlist">
          <MainLayout>
            <ReadListsPage />
          </MainLayout>
        </Route>
        <Route path="/readlist/:readlistId">
          {() => (
            <MainLayout>
              <ReadListPage />
            </MainLayout>
          )}
        </Route>
        <Route path="/readlist/:readlistId/edit">
          {({readlistId}) => (
            <MainLayout>
              <ReadListEditPage readlistId={readlistId ?? ''} />
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

        {/* ANCHOR Unit Routes */}
        <Route path="/unit">
          <MainLayout>
            <UnitsPage />
          </MainLayout>
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
        <Route path="/tag/book/:bookId/tag">
          {({bookId}) => (
            <MainLayout>
              <TagByBookFullPage bookId={bookId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/tag/book/:bookId/tag/:domainId">
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
        <Route path="/user/me/bookmark">
          <MainLayout>
            <BookmarkPage />
          </MainLayout>
        </Route>
        <Route path="/user/me/reaction">
          <MainLayout>
            <ReactionInfoPage isCurrentUser={true} />
          </MainLayout>
        </Route>
        <Route path="/user/me/follow">
          <MainLayout>
            <FollowInfoPage isCurrentUser={true} />
          </MainLayout>
        </Route>
        <Route path="/user/:unitId">
          {({unitId}) => (
            <MainLayout>
              <UserPage unitId={unitId} />
            </MainLayout>
          )}
        </Route>
        <Route path="/user/:unitId/edit">
          {({unitId}) => (
            <MainLayout>
              <UserEditPage unitId={unitId} />
            </MainLayout>
          )}
        </Route>

        {/* ANCHOR Misc */}
        <Route path="/misc/notice">
          <MainLayout>
            <NoticePage />
          </MainLayout>
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
