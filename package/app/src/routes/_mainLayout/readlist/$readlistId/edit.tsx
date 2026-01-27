import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReadListEditPage = lazyRouteComponent(
  () => import('@/page/ReadList/ReadListEditPage'),
  'ReadListEditPage',
);

export const Route = createFileRoute('/_mainLayout/readlist/$readlistId/edit')({
  component: ReadListEditPage,
});

