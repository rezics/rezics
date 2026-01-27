import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditChapterPage = lazyRouteComponent(
  () => import('@/page/BookEdit/ChapterPage'),
  'BookEditChapterPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/$chapterId')({
  component: BookEditChapterPage,
});

