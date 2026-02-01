import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookReadChapterPage = lazyRouteComponent(
  () => import('@/page/Book/ChapterPage'),
  'BookReadChapterPage',
);

export const Route = createFileRoute('/book_/$bookId/read/$chapterId/')({
  component: BookReadChapterPage,
});
