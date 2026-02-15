import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditChapterPage = lazyRouteComponent(
  () => import('@/book-edit'),
  'BookEditChapterPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/$chapterId')({
  component: BookEditChapterPage,
});
