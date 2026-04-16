import { useAlertStore } from "@app/state/windowAlertStore";
import { TextField } from "@mui/material";
import { useUpdateUnitMutation } from "@rezics/api/unit/unit.mutations";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import { RezicsMarkdownEditor } from "@rezics/ui/editor";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { QueryErrorDisplay } from "@/core/component/QueryErrorDisplay";
import { quoteEditRoute } from "@/router";

interface QuoteEditPageProps {
  unitId: string;
  data: UnitFormData;
  setData: (data: UnitFormData) => void;
}

export function QuoteEditPage({ unitId, data, setData }: QuoteEditPageProps) {
  const { t } = useTranslation();
  const { show } = useAlertStore();
  const translation = data.translations?.[0];
  const source = useMemo(
    () => (data.extra as Record<string, any>)?.source || "",
    [data.extra],
  );

  const { mutate, isPending } = useUpdateUnitMutation({
    onSuccess: (data) => {
      show(t("quote.updated_success"));
      console.log("update quote success", data);
    },
    onError: (error) => {
      show(t("quote.messages.update_failed", { error: String(error) }));
      console.error("update quote failed", error);
    },
  });

  function handleSave() {
    mutate({
      unitId: unitId,
      input: {
        extra: data.extra ?? undefined,
        status: data.status || undefined,
      },
    });
    // TODO: update translation (title, description) via translation API
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-2">
        <TextField
          id="quote-title"
          label={t("quote.form.title")}
          variant="standard"
          value={translation?.title || ""}
          onChange={(e) =>
            setData({
              ...data,
              translations: [
                { ...(translation || { language: "en" }), title: e.target.value },
              ],
            })
          }
        />
      </div>

      <div className="flex flex-col gap-2">
        <TextField
          id="quote-source"
          label={t("quote.form.source")}
          variant="standard"
          value={source}
          onChange={(e) =>
            setData({
              ...data,
              extra: { ...((data.extra as Record<string, any>) || {}), source: e.target.value },
            })
          }
        />
      </div>

      <div className="flex-1 min-h-[300px]">
        <RezicsMarkdownEditor
          value={translation?.description || ""}
          onChange={(value) =>
            setData({
              ...data,
              translations: [
                { ...(translation || { language: "en" }), description: value },
              ],
            })
          }
          onSubmit={handleSave}
          submitLabel={t("common.save")}
        />
      </div>
    </div>
  );
}

export function QuoteEditPageContainer() {
  const { unitId } = quoteEditRoute.useParams();
  const {
    data: unitData,
    isLoading,
    error,
  } = useQuery(unitQueries.detail(unitId));
  const [quoteData, setQuoteData] = useState<UnitFormData>({} as UnitFormData);

  useEffect(() => {
    if (unitData) {
      setQuoteData({
        type: unitData.type || "",
        status: unitData.status || "",
        extra: unitData.extra ?? undefined,
        translations: unitData.translations?.map((tr) => ({
          language: tr.language,
          title: tr.title ?? undefined,
          subtitle: tr.subtitle ?? undefined,
          summary: tr.summary ?? undefined,
          description: tr.description ?? undefined,
        })),
      });
    }
  }, [unitData]);

  if (isLoading) {
    return <div>Loading...</div>;
  }
  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <QuoteEditPage unitId={unitId} data={quoteData} setData={setQuoteData} />
    </div>
  );
}
