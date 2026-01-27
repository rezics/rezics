import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookmarkPage = lazyRouteComponent(() => import('@/page/User/BookmarkPage'), 'BookmarkPage');

export const Route = createFileRoute('/_mainLayout/user/me/bookmark')({
  component: BookmarkPage,
});

