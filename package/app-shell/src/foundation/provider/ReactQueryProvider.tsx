import {QueryClientProvider} from '@tanstack/react-query';
import React, {useEffect} from 'react';
import {qc} from './reactQueryUtil';

export function ReactQueryProvider({children}: {children: React.ReactNode}) {
  useEffect(() => {
    (window as any).__TANSTACK_QUERY_CLIENT__ = qc;
  }, []);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
