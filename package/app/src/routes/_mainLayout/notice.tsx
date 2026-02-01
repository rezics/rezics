import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NoticePage = lazyRouteComponent(
  () => import('@/page/Misc/Notice'),
  'NoticePage',
);

export const Route = createFileRoute('/_mainLayout/notice')({
  component: NoticePage,
});
