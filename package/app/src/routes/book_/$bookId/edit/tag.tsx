import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditTagPage = lazyRouteComponent(
  () => import('@feature/book/edit'),
  'BookEditTagPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/tag')({
  component: BookEditTagPage,
});
