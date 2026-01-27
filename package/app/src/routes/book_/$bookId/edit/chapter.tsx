import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookEditChapterListPage = lazyRouteComponent(
  () => import('@/page/BookEdit/ChapterListPage'),
  'BookEditChapterListPage',
);

export const Route = createFileRoute('/book_/$bookId/edit/chapter')({
  component: BookEditChapterListPage,
});

