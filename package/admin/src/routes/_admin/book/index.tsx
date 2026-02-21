import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

export const Route = createFileRoute('/_admin/book/')({
  component: lazyRouteComponent(
    () => import('@/book/page/BooksPage'),
    'default',
  ),
});
