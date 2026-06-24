"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { ServiceUnavailableOverlay } from "./ServiceUnavailableOverlay";

function FetchScenario({
  mode,
  children,
}: {
  readonly mode: "healthy" | "unavailable";
  readonly children: ReactNode;
}) {
  const originalFetch = useRef<typeof fetch | null>(null);

  if (typeof globalThis.fetch === "function" && originalFetch.current === null) {
    originalFetch.current = globalThis.fetch;
    globalThis.fetch = (mode === "healthy"
      ? () => Promise.resolve(new Response(null, { status: 204 }))
      : () => Promise.reject(new TypeError("Fixture health check failed"))) as typeof fetch;
  }

  useEffect(() => {
    return () => {
      if (originalFetch.current) {
        globalThis.fetch = originalFetch.current;
      }
    };
  }, []);

  return children;
}

function DemoPage({ short = false }: { readonly short?: boolean }) {
  return (
    <div className={short ? "min-h-[420px] p-4" : "min-h-screen p-6"}>
      <div className="mx-auto w-full max-w-2xl rounded-md border p-4">
        <p className="text-sm font-medium">Fixture page content</p>
        <p className="text-muted-foreground mt-2 text-sm">
          The overlay should cover this page when the health check fails.
        </p>
      </div>
      <ServiceUnavailableOverlay />
    </div>
  );
}

export default {
  HealthyHidden: (
    <FetchScenario mode="healthy">
      <DemoPage />
    </FetchScenario>
  ),

  UnavailableOverlay: (
    <FetchScenario mode="unavailable">
      <DemoPage />
    </FetchScenario>
  ),

  ShortViewportUnavailable: (
    <FetchScenario mode="unavailable">
      <DemoPage short />
    </FetchScenario>
  ),
};
