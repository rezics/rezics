import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReadListPage = lazyRouteComponent(
  () => import('@/page/ReadList/ReadListPage'),
  'ReadListPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/$readlistId/')({
  component: ReadListPage,
});
