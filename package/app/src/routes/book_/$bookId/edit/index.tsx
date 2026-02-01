import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditMainPage = lazyRouteComponent(
  () => import('@feature/book/edit'),
  'BookEditMainPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/')({
  component: BookEditMainPage,
});
