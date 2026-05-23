import { useAlertStore } from "@app/states/windowAlertStore";
import { Input, Label } from "@rezics/ui/shadcn";
import { useUpdateUnitMutation } from "@rezics/api/unit/unit.mutations";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import type { ExcerptSource } from "@rezics/contract";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { QueryErrorDisplay } from "@/core/components/QueryErrorDisplay";
import { Route as excerptEditRoute } from "@/routes/_mainLayout/excerpt/$unitId/edit";
import { ExcerptSourcePicker } from "../components/source/ExcerptSourcePicker";
import * as m from "@rezics/i18n/messages";

interface ExcerptEditPageProps {
  unitId: string;
  data: UnitFormData;
  setData: (data: UnitFormData) => void;
  targetUnitId?: string;
}

export function ExcerptEditPage({
  unitId,
  data,
  setData,
  targetUnitId,
}: ExcerptEditPageProps) {
  const { show } = useAlertStore();
  const translation = data.translations?.[0];
  const extra = (data.extra as Record<string, any>) ?? {};
  const source = extra.source as ExcerptSource | undefined;

  const { mutate } = useUpdateUnitMutation({
    onSuccess: (result) => {
      show(m.excerpt_updated_success());
      console.log("update excerpt success", result);
    },
    onError: (error) => {
      show(m.excerpt_messages_update_failed({ error: String(error) }));
      console.error("update excerpt failed", error);
    },
  });

  function handleSave() {
    mutate({
      unitId,
      input: {
        extra: data.extra ?? undefined,
        status: data.status || undefined,
      },
    });
    // TODO: update translation (title, description) via translation API
  }

  function handleSourceChange(next: ExcerptSource | undefined) {
    setData({
      ...data,
      extra: {
        ...extra,
        source: next,
      },
    });
  }

  return (
    <div className="flex flex-col gap-4 mt-2">
      <div className="flex flex-col gap-1">
        <Label htmlFor="excerpt-title">{m.excerpt_form_title()}</Label>
        <Input
          id="excerpt-title"
          value={translation?.title || ""}
          onChange={(e) =>
            setData({
              ...data,
              translations: [
                {
                  ...(translation || { language: "en" }),
                  title: e.target.value,
                },
              ],
            })
          }
        />
      </div>

      <ExcerptSourcePicker
        value={source}
        onChange={handleSourceChange}
        targetUnitId={targetUnitId}
      />

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
          submitLabel={m.common_save()}
        />
      </div>
    </div>
  );
}

export function ExcerptEditPageContainer() {
  const { unitId } = excerptEditRoute.useParams();
  const {
    data: unitData,
    isLoading,
    error,
  } = useQuery(unitQueries.detail(unitId));
  const [excerptData, setExcerptData] = useState<UnitFormData>(
    {} as UnitFormData,
  );

  useEffect(() => {
    if (unitData) {
      setExcerptData({
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
    return <div>{m.common_loading()}</div>;
  }
  if (error) {
    return <QueryErrorDisplay error={error} />;
  }

  return (
    <div className="max-w-4xl mx-auto mt-4">
      <ExcerptEditPage
        unitId={unitId}
        data={excerptData}
        setData={setExcerptData}
        targetUnitId={unitData?.workUnitId ?? undefined}
      />
    </div>
  );
}
