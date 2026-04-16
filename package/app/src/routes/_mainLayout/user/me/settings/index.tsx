import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_mainLayout/user/me/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/user/me/settings/profile' });
  },
});
