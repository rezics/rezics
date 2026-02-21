import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const FollowInfoPage = lazyRouteComponent(
  () => import('@/user/page/FollowInfoPage'),
  'FollowInfoPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/follow')({
  component: () => <FollowInfoPage isCurrentUser={true} />,
});
