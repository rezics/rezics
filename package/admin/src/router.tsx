import { createRouter } from '@tanstack/react-router';
import { routeTree } from './routeTree.gen.ts';

import { qc } from '@/plugin/providers/reactQueryUtil';

export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: 'intent',
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

