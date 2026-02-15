import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

const BookEditLayout = lazyRouteComponent(
  () => import('@/book-edit/layout/BookEditLayout'),
  'BookEditLayout',
);

export const Route = createFileRoute('/book_/$bookId/edit')({
  component: () => (
    <BookEditLayout>
      <Outlet />
    </BookEditLayout>
  ),
});
