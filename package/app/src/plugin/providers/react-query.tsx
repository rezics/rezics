// import { attachBroadcast } from "@/api/react-query/broadcast";
// import { attachPersistence } from "@/api/react-query/persist";
import {createQueryClient} from '@/api/react-query/tsr';
import {QueryClientProvider} from '@tanstack/react-query';
import React from 'react';

const qc = createQueryClient();
// attachPersistence(qc);
// attachBroadcast(qc);

export function ReactQueryProvider({children}: {children: React.ReactNode}) {
  (window as any).__TANSTACK_QUERY_CLIENT__ = qc;
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
