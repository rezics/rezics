import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const BookLibPage = lazyRouteComponent(
  () => import('@feature/book/library'),
  'BookLibPage',
);

export const Route = createFileRoute('/_mainLayout/book/')({
  component: BookLibPage,
  validateSearch: (search: Record<string, unknown>): {tags?: string} => {
    return {
      tags: typeof search.tags === 'string' ? search.tags : undefined,
    };
  },
});
