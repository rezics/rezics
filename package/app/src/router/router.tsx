import {ThemeProvider} from '@mui/material';
import {Route, Router, Switch} from 'wouter';
import {lazy} from 'react';

// ========== Pages ==========
export const LoginPage = lazy(() =>
  import('@/page/Auth/LoginPage').then(m => ({default: m.LoginPage})),
);

export const RegisterPage = lazy(() =>
  import('@/page/Auth/RegisterPage').then(m => ({default: m.RegisterPage})),
);

export const ResetPasswordPage = lazy(() =>
  import('@/page/Auth/ResetPasswordPage').then(m => ({
    default: m.ResetPasswordPage,
  })),
);

export const HomeContainer = lazy(() =>
  import('@/page/Home').then(m => ({default: m.HomeContainer})),
);

export const NotFoundContainer = lazy(() =>
  import('@/page/NotFound').then(m => ({default: m.NotFoundContainer})),
);

// ========== Token ==========
export const TokenPage = lazy(() =>
  import('@/page/Token/TokenPage').then(m => ({default: m.TokenPage})),
);

// ========== Book ==========
export const BookLibContainer = lazy(() =>
  import('@/page/Book/BookLibPage').then(m => ({default: m.BookLibContainer})),
);

export const BookPageContainer = lazy(() =>
  import('@/page/Book/BookPage').then(m => ({default: m.BookPageContainer})),
);

// ========== Book – Read ==========
export const BookReadLayout = lazy(() =>
  import('@/layout/BookReadLayout').then(m => ({default: m.BookReadLayout})),
);

export const BookReadChapterPage = lazy(() =>
  import('@/page/Book/ChapterPage').then(m => ({
    default: m.BookReadChapterPage,
  })),
);

// ========== Book – Edit ==========
export const BookEditLayout = lazy(() =>
  import('@/layout/BookEditLayout').then(m => ({default: m.BookEditLayout})),
);

export const BookEditChapterPage = lazy(() =>
  import('@/page/BookEdit/ChapterPage').then(m => ({
    default: m.BookEditChapterPage,
  })),
);

export const BookEditTagPage = lazy(() =>
  import('@/page/BookEdit/TagPage').then(m => ({default: m.BookEditTagPage})),
);

export const BookEditMainPage = lazy(() =>
  import('@/page/BookEdit/InfoPage').then(m => ({default: m.BookEditMainPage})),
);

export const NewBookPage = lazy(() =>
  import('@/page/BookEdit/NewBookPage').then(m => ({default: m.NewBookPage})),
);

export const BookEditChapterListPage = lazy(() =>
  import('@/page/BookEdit/ChapterListPage').then(m => ({
    default: m.BookEditChapterListPage,
  })),
);

// ========== Review Pages ==========
export const ReviewsPage = lazy(() =>
  import('@/page/Review/ReviewsPage').then(m => ({default: m.ReviewsPage})),
);

export const ReviewPage = lazy(() =>
  import('@/page/Review/ReviewPage').then(m => ({default: m.ReviewPage})),
);

export const ReviewNewPage = lazy(() =>
  import('@/page/Review/ReviewNewPage').then(m => ({default: m.ReviewNewPage})),
);

export const ReviewEditPageContainer = lazy(() =>
  import('@/page/Review/ReviewEditPage').then(m => ({
    default: m.ReviewEditPageContainer,
  })),
);

export const QuoteByBookPage = lazy(() =>
  import('@/page/Review/QuoteByBookPage').then(m => ({
    default: m.QuoteByBookPage,
  })),
);

export const QuotePage = lazy(() =>
  import('@/page/Review/QuotePage').then(m => ({default: m.QuotePage})),
);

export const QuoteEditPageContainer = lazy(() =>
  import('@/page/Review/QuoteEditPage').then(m => ({
    default: m.QuoteEditPageContainer,
  })),
);

// ========== ReadList Pages ==========
export const ReadListPage = lazy(() =>
  import('@/page/ReadList/ReadListPage').then(m => ({default: m.ReadListPage})),
);

export const ReadListsPage = lazy(() =>
  import('@/page/ReadList/ReadListsPage').then(m => ({
    default: m.ReadListsPage,
  })),
);

// ========== Unit Pages ==========
export const UnitsPage = lazy(() =>
  import('@/page/Unit/UnitsPage').then(m => ({default: m.UnitsPage})),
);

export const UnitPage = lazy(() =>
  import('@/page/Unit/UnitPage').then(m => ({default: m.UnitPage})),
);

// ========== Tag Pages ==========
export const TagByBookPage = lazy(() =>
  import('@/page/Tag/TagByUnitPage').then(m => ({default: m.TagByBookPage})),
);

export const TagByBookFullPage = lazy(() =>
  import('@/page/Tag/TagByUnitPage').then(m => ({
    default: m.TagByBookFullPage,
  })),
);

export const TagDomainPage = lazy(() =>
  import('@/page/Tag/TagDomain').then(m => ({default: m.TagDomainPage})),
);

export const TagUnitPage = lazy(() =>
  import('@/page/Tag/TagUnitPage').then(m => ({default: m.TagUnitPage})),
);

// ========== User Pages ==========
export const UserEditPage = lazy(() =>
  import('@/page/User/UserEditPage').then(m => ({default: m.UserEditPage})),
);

export const BookmarkPage = lazy(() =>
  import('@/page/User/BookmarkPage').then(m => ({default: m.BookmarkPage})),
);

export const FollowInfoPage = lazy(() =>
  import('@/page/User/FollowInfoPage').then(m => ({default: m.FollowInfoPage})),
);

export const UserPage = lazy(() =>
  import('@/page/User/UserPage').then(m => ({default: m.UserPage})),
);

export const ReactionInfoPage = lazy(() =>
  import('@/page/User/ReactionInfoPage').then(m => ({
    default: m.ReactionInfoPage,
  })),
);

// ========== Misc ==========
export const MainLayout = lazy(() =>
  import('@/layout/MainLayout').then(m => ({default: m.MainLayout})),
);

export const MeiliPage = lazy(() =>
  import('@/page/Meili/MeiliPage').then(m => ({default: m.MeiliPage})),
);

export const ReadListEditPage = lazy(() =>
  import('@/page/ReadList/ReadListEditPage').then(m => ({
    default: m.ReadListEditPage,
  })),
);

export const NewReadListPage = lazy(() =>
  import('@/page/ReadList/NewReadListPage').then(m => ({
    default: m.NewReadListPage,
  })),
);

export const ReadlistByBookPage = lazy(() =>
  import('@/page/ReadList/ReadListsByBookPage').then(m => ({
    default: m.ReadlistByBookPage,
  })),
);

export const ReviewByBookPage = lazy(() =>
  import('@/page/Review/ReviewByBookPage').then(m => ({
    default: m.ReviewByBookPage,
  })),
);

// Test
export const TestPage = lazy(() => import('@/page/Test/TestPage'));

export const TestPage02 = lazy(() =>
  import('@/page/Test/TestPage02').then(m => ({default: m.TestPage02})),
);

export const TestPage03 = lazy(() =>
  import('@/page/Test/TestPage03').then(m => ({default: m.TestPage03})),
);

// Echokv
export const EchokvEditPage = lazy(() => import('@/page/Misc/EchokvEdit'));

// Notice
export const NoticePage = lazy(() =>
  import('@/page/Misc/Notice').then(m => ({default: m.NoticePage})),
);

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
        <Route path="/meili">
          <MainLayout>
            <MeiliPage />
          </MainLayout>
        </Route>
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
        <Route path="/reset-password">
          <MainLayout>
            <ResetPasswordPage />
          </MainLayout>
        </Route>

        {/* ANCHOR Token Routes */}
        <Route path="/token">
          <MainLayout>
            <TokenPage />
          </MainLayout>
        </Route>

        {/* ANCHOR Book Read*/}
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
        <Route path="/book/:bookId/edit">
          {({bookId}) => (
            <BookEditLayout bookId={bookId}>
              <BookEditMainPage bookId={bookId} />
            </BookEditLayout>
          )}
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
        <Route path="/book/:bookId/edit/tag">
          {({bookId}) => (
            <BookEditLayout bookId={bookId}>
              <BookEditTagPage bookId={bookId} />
            </BookEditLayout>
          )}
        </Route>

        {/* ANCHOR Book */}
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
        {/* <Route path="/review/short/book/:bookId">
          {() => (
            <MainLayout>
              <ShortReviewByBookPage />
            </MainLayout>
          )}
        </Route> */}
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
        <Route path="/quote/:unitId/edit">
          {({unitId}) => (
            <MainLayout>
              <QuoteEditPageContainer unitId={unitId} />
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
          {({bookId}) => (
            <MainLayout>
              <ReadlistByBookPage bookId={bookId} />
            </MainLayout>
          )}
        </Route>

        {/* ANCHOR Unit Routes */}
        <Route path="/unit">
          <MainLayout>
            <UnitsPage />
          </MainLayout>
        </Route>
        <Route path="/unit/:unitId">
          {({unitId}) => (
            <MainLayout>
              <UnitPage unitId={unitId} />
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
        <Route path="/misc/echokv">
          <MainLayout>
            <EchokvEditPage />
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
