import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const FollowInfoPage = lazyRouteComponent(
  () => import('@/page/User/FollowInfoPage'),
  'FollowInfoPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/follow')({
  component: () => <FollowInfoPage isCurrentUser={true} />,
});

