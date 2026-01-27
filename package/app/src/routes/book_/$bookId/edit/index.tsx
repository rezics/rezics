import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditMainPage = lazyRouteComponent(
  () => import('@/page/BookEdit/InfoPage'),
  'BookEditMainPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/')({
  component: BookEditMainPage,
});

