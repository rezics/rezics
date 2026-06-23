"use client";

import { RegistryProvider } from "@effect/atom-react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <RegistryProvider>
      <NuqsAdapter>{children}</NuqsAdapter>
    </RegistryProvider>
  );
}
