import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditTagPage = lazyRouteComponent(
  () => import('@/page/BookEdit/TagPage'),
  'BookEditTagPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/tag')({
  component: BookEditTagPage,
});
