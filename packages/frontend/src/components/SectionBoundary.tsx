"use client";

import { Suspense, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

function ErrorFallback({ error, resetErrorBoundary }: FallbackProps) {
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-destructive text-sm">{error instanceof Error ? error.message : "Something went wrong"}</p>
      <button
        className="bg-primary text-primary-foreground rounded-md px-3 py-1.5 text-sm font-medium"
        onClick={resetErrorBoundary}
        type="button"
      >
        Retry
      </button>
    </div>
  );
}

export function SectionBoundary({
  children,
  fallback,
}: {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}) {
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <Suspense
        fallback={
          fallback ?? (
            <div className="flex justify-center py-12">
              <div className="border-primary size-6 animate-spin rounded-full border-2 border-t-transparent" />
            </div>
          )
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
