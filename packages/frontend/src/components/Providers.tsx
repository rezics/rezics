"use client";

import { LocaleSync } from "@/lib/i18n/locale";
import { ServiceUnavailableOverlay } from "@/components/ServiceUnavailableOverlay";
import { RegistryProvider } from "@effect/atom-react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

export function Providers({ children }: { readonly children: ReactNode }) {
  return (
    <RegistryProvider>
      <NuqsAdapter>
        <LocaleSync />
        {children}
        <ServiceUnavailableOverlay />
      </NuqsAdapter>
    </RegistryProvider>
  );
}
