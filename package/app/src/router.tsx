import {routeTree} from './routeTree.gen';
import {createRouter} from '@tanstack/react-router';
import {qc} from '@/plugin/providers/reactQueryUtil';

export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: 'intent',
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  getScrollRestorationKey: location => {
    const tab = new URLSearchParams(location.search ?? '').get('tab') ?? '';
    return `${location.pathname}::tab=${tab}`;
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Compatibility exports for legacy imports.
//
// Many modules import route objects from `@/router/router` to call
// `someRoute.useParams()` / `someRoute.useMatch()`.
//
// In TanStack Router's file-based routing, those route objects live in the
// corresponding `src/routes/**` files as `export const Route = ...`.
//
// This file re-exports them under the historical names used across the app.

export {Route as unitRoute} from '@/routes/_mainLayout/unit/$unitId';

export {Route as reviewRoute} from '@/routes/_mainLayout/review/$reviewId';
export {Route as reviewEditRoute} from '@/routes/_mainLayout/review/$reviewId/edit';
export {Route as reviewNewRoute} from '@/routes/_mainLayout/review/new/$bookUnitId';
export {Route as reviewByBookRoute} from '@/routes/_mainLayout/review/book/$bookId';

export {Route as remarkRoute} from '@/routes/_mainLayout/remark/$reviewId';

export {Route as quoteRoute} from '@/routes/_mainLayout/quote/$unitId';
export {Route as quoteEditRoute} from '@/routes/_mainLayout/quote/$unitId/edit';
export {Route as quoteByBookRoute} from '@/routes/_mainLayout/quote/book/$bookId';

export {Route as readlistByBookRoute} from '@/routes/_mainLayout/readlist/book/$bookId';
export {Route as readlistEditRoute} from '@/routes/_mainLayout/readlist/$readlistId/edit';

export {Route as userRoute} from '@/routes/_mainLayout/user/$unitId';
export {Route as userEditRoute} from '@/routes/_mainLayout/user/$unitId/edit';

export {Route as tagUnitRoute} from '@/routes/_mainLayout/tag/$unitId';
export {Route as tagDomainRoute} from '@/routes/_mainLayout/tag/domain/$unitId/route';
export {Route as tagDomainTitleRoute} from '@/routes/_mainLayout/tag/domain/$unitId/title/$title';

export {Route as tagBookRoute} from '@/routes/_mainLayout/tag/book/$bookId/route';
export {Route as tagBookFullRoute} from '@/routes/_mainLayout/tag/book/$bookId/tag/route';
export {Route as tagBookFullDomainRoute} from '@/routes/_mainLayout/tag/book/$bookId/tag/$domainId';

export {Route as bookEditLayoutRoute} from '@/routes/book_/$bookId/edit/route';
export {Route as bookEditChapterRoute} from '@/routes/book_/$bookId/edit/$chapterId';

export {Route as bookReadLayoutRoute} from '@/routes/book_/$bookId/read/$chapterId/route';
