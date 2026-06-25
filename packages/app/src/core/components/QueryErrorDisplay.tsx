import { ApiError } from "@rezics/contract/api/react-query/errors";
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
  const databaseDetail = isApiError ? error.detail?.database : undefined;
  const hasDetail = isApiError && (databaseDetail || error.status);

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
                {databaseDetail && (
                  <>
                    <div>
                      {t("common:database_error", {
                        code: databaseDetail.code,
                      })}
                    </div>
                    {databaseDetail.table && (
                      <div>
                        {t("common:error_model", {
                          model: databaseDetail.table,
                        })}
                      </div>
                    )}
                    {databaseDetail.constraint && (
                      <div>
                        {t("common:error_target", {
                          target: databaseDetail.constraint,
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
