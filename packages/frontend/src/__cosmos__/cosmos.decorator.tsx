"use client";

import "@/app/globals.css";

import { RegistryProvider } from "@effect/atom-react";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import type { ReactNode } from "react";

export default function CosmosDecorator({ children }: { readonly children: ReactNode }) {
  return (
    <RegistryProvider>
      <NuqsAdapter>
        <div className="bg-background text-foreground min-h-screen antialiased">
          {children}
        </div>
      </NuqsAdapter>
    </RegistryProvider>
  );
}
