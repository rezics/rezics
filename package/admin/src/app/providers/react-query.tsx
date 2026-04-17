import { QueryClientProvider } from "@tanstack/react-query";
import type React from "react";
import { useEffect } from "react";
import { createQueryClient } from "@rezics/api/react-query/tsr";

const qc = createQueryClient();

export function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    (window as any).__TANSTACK_QUERY_CLIENT__ = qc;
  }, []);
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}
