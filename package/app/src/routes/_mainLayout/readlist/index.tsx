import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

const ReadListsPage = lazyRouteComponent(
  () => import('@/page/ReadList/ReadListsPage'),
  'ReadListsPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/')({
  component: ReadListsPage,
});

