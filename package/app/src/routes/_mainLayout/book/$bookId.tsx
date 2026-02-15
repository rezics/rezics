import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookDetailPage = lazyRouteComponent(
  () => import('@/book-library'),
  'BookDetailPage',
);

export const Route = createFileRoute('/_mainLayout/book/$bookId')({
  component: () => <BookDetailPage />,
});
