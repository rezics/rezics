import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const ReactionInfoPage = lazyRouteComponent(
  () => import('@/page/User/ReactionInfoPage'),
  'ReactionInfoPage',
);

export const Route = createFileRoute('/_mainLayout/user/me/reaction')({
  component: () => <ReactionInfoPage isCurrentUser={true} />,
});
