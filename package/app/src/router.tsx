import { routeTree } from './routeTree.gen'
import { createRouter } from '@tanstack/react-router'
import { qc } from '@/plugin/providers/reactQueryUtil'


export const router = createRouter({
  routeTree,
  context: {
    qc,
  },
  defaultPreload: 'intent',
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
})
