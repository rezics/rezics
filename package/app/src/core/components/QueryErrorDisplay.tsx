import { ApiError } from "@rezics/api";
import { useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription } from "@rezics/ui/shadcn";
import { useState } from "react";

interface QueryErrorDisplayProps {
  error: Error | null;
  className?: string;
}

export function QueryErrorDisplay({
  error,
  className,
}: QueryErrorDisplayProps) {
  const { t } = useTranslation(["common"]);
  const [detailOpen, setDetailOpen] = useState(false);

  if (!error) return null;

  const isApiError = error instanceof ApiError;
  const message = error.message || t("common:unexpected_error");
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
              {detailOpen ? "▾" : "▸"} {t("common:technical_details")}
            </button>
            {detailOpen && (
              <div className="text-xs mt-1 font-mono text-text-secondary">
                {prismaDetail && (
                  <>
                    <div>
                      {t("common:prisma_error", { code: prismaDetail.code })}
                    </div>
                    {prismaDetail.model && (
                      <div>
                        {t("common:error_model", { model: prismaDetail.model })}
                      </div>
                    )}
                    {prismaDetail.target && (
                      <div>
                        {t("common:error_target", {
                          target: prismaDetail.target.join(", "),
                        })}
                      </div>
                    )}
                  </>
                )}
                <div>{t("common:http_error", { status: error.status })}</div>
              </div>
            )}
          </>
        )}
      </AlertDescription>
    </Alert>
  );
}
