import { ApiError } from "@rezics/api";
import {
  common_error_model,
  common_error_target,
  common_http_error,
  common_prisma_error,
  common_technical_details,
  common_unexpected_error,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { useState } from "react";

const i18nMessages = {
  common_error_model,
  common_error_target,
  common_http_error,
  common_prisma_error,
  common_technical_details,
  common_unexpected_error,
};

interface QueryErrorDisplayProps {
  error: Error | null;
  className?: string;
}

export function QueryErrorDisplay({
  error,
  className,
}: QueryErrorDisplayProps) {
  const m = useMessage(i18nMessages);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = error.message || m.common_unexpected_error();
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
              {detailOpen ? "▾" : "▸"} {m.common_technical_details()}
            </button>
            {detailOpen && (
              <div className="text-xs mt-1 font-mono text-text-secondary">
                {prismaDetail && (
                  <>
                    <div>
                      {m.common_prisma_error({ code: prismaDetail.code })}
                    </div>
                    {prismaDetail.model && (
                      <div>
                        {m.common_error_model({ model: prismaDetail.model })}
                      </div>
                    )}
                    {prismaDetail.target && (
                      <div>
                        {m.common_error_target({
                          target: prismaDetail.target.join(", "),
                        })}
                      </div>
                    )}
                  </>
                )}
                <div>{m.common_http_error({ status: error.status })}</div>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
