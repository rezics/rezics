import {createFileRoute, lazyRouteComponent, Outlet} from '@tanstack/react-router';

const BookReadLayout = lazyRouteComponent(
  () => import('@/layout/BookReadLayout'),
  'BookReadLayout',
);

export const Route = createFileRoute('/book_/$bookId/read/$chapterId')({
  component: () => (
    <BookReadLayout>
      <Outlet />
    </BookReadLayout>
  ),
});

