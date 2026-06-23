"use client";

import { Spinner } from "@/components/ui/spinner";
import { useT } from "@/lib/i18n/locale";
import { Suspense, type ReactNode } from "react";
import { ErrorBoundary, type FallbackProps } from "react-error-boundary";

interface SectionBoundaryProps {
  readonly children: ReactNode;
  readonly fallback?: ReactNode;
}

function PageError({ error, resetErrorBoundary }: FallbackProps) {
  const [t] = useT();
  const message =
    error instanceof Error && error.message.length > 0
      ? error.message
      : t.common.error;
  return (
    <div className="flex flex-col items-center gap-3 py-12">
      <p className="text-muted-foreground text-sm">{message}</p>
      <button
        className="text-primary text-sm underline underline-offset-4"
        onClick={resetErrorBoundary}
        type="button"
      >
        {t.common.retry}
      </button>
    </div>
  );
}

/**
 * Mobile / Tablet / Desktop / Ultra-wide (all identical):
 *
 * Loading state:
 * +-------------------------------+
 * |          [Spinner]            |
 * |          (py-12)              |
 * +-------------------------------+
 *
 * ErrorBoundary + Suspense 包裹层。
 * 加载中显示居中 spinner，出错显示错误信息 + 重试按钮。
 */
export function SectionBoundary({ children, fallback }: SectionBoundaryProps) {
  return (
    <ErrorBoundary FallbackComponent={PageError}>
      <Suspense
        fallback={
          fallback ?? (
            <div className="flex justify-center py-12">
              <Spinner />
            </div>
          )
        }
      >
        {children}
      </Suspense>
    </ErrorBoundary>
  );
}
