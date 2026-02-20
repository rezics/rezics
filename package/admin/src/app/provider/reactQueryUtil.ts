import {QueryClient} from '@tanstack/react-query';

export const qc = new QueryClient({
  defaultOptions: {
    queries: {
      // Avoid showing queries as immediately stale everywhere (devtools/UI).
      staleTime: 30_000,
    },
  },
});
