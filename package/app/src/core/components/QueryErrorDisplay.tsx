import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { ApiError } from "@rezics/api";
import { useState } from "react";

interface QueryErrorDisplayProps {
  error: Error | null;
  className?: string;
}

export function QueryErrorDisplay({
  error,
  className,
}: QueryErrorDisplayProps) {
  const [detailOpen, setDetailOpen] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = error.message || "An unexpected error occurred";
  const prismaDetail = isApiError ? error.detail?.prisma : undefined;
  const hasDetail = isApiError && (prismaDetail || error.status);

  return (
    <Alert variant="destructive" className={className}>
      <AlertDescription>
        <p className="text-sm m-0">{message}</p>
        {hasDetail && (
          <>
            <button
              type="button"
              onClick={() => setDetailOpen((v) => !v)}
              className="text-xs cursor-pointer select-none mt-1 block text-text-secondary bg-transparent border-0 p-0"
            >
              {detailOpen ? "▾" : "▸"} Technical details
            </button>
            {detailOpen && (
              <div className="text-xs mt-1 font-mono text-text-secondary">
                {prismaDetail && (
                  <>
                    <div>Prisma {prismaDetail.code}</div>
                    {prismaDetail.model && (
                      <div>Model: {prismaDetail.model}</div>
                    )}
                    {prismaDetail.target && (
                      <div>Target: {prismaDetail.target.join(", ")}</div>
                    )}
                  </>
                )}
                <div>HTTP {error.status}</div>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
