import {
  createFileRoute,
  lazyRouteComponent,
  Outlet,
} from '@tanstack/react-router';

const BookEditLayout = lazyRouteComponent(
  () => import('@feature/core/layout/BookEditLayout'),
  'BookEditLayout',
);

export const Route = createFileRoute('/book_/$bookId/edit')({
  component: () => (
    <BookEditLayout>
      <Outlet />
    </BookEditLayout>
  ),
});
