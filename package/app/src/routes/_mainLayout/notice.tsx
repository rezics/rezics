import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const NoticePage = lazyRouteComponent(
  () => import('@feature/info/notice/page/Notice'),
  'NoticePage',
);

export const Route = createFileRoute('/_mainLayout/notice')({
  component: NoticePage,
});
