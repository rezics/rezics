import {createFileRoute, lazyRouteComponent} from '@tanstack/react-router';

const EchokvEditPage = lazyRouteComponent(() => import('@/page/Misc/EchokvEdit'));

export const Route = createFileRoute('/_mainLayout/misc/echokv')({
  component: EchokvEditPage,
});

