import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookReadChapterPage = lazyRouteComponent(
  () => import('@/book-read'),
  'BookReadChapterPage',
);

export const Route = createFileRoute('/book_/$bookId/read/$chapterId/')({
  component: BookReadChapterPage,
});
