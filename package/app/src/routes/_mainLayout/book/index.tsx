import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookLibContainer = lazyRouteComponent(
  () => import('@/page/Book/BookLibPage'),
  'BookLibContainer',
);

export const Route = createFileRoute('/_mainLayout/book/')({
  component: BookLibContainer,
  validateSearch: (search: Record<string, unknown>) => {
    return {
      tags: typeof search.tags === 'string' ? search.tags : undefined,
    };
  },
});
