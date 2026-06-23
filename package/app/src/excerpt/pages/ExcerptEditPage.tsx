import {
  useUpdateUnitMutation,
  useUpsertTranslationMutation,
} from "@rezics/api/unit/unit.mutations";
import { unitQueries } from "@rezics/api/unit/unit.queries";
import { toast } from "sonner";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import {
  contentDocMarkdownFallback,
  type ExcerptSource,
  markdownContentDoc,
} from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { Input, Label } from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  isApiNotFoundError,
  QueryErrorDisplay,
  ResourceNotFoundState,
} from "@/core";
import { Route as excerptEditRoute } from "@/routes/_editor/excerpt/$unitId/edit";
import { RezicsMarkdownEditor } from "@/shared/ui/RezicsMarkdownEditor";
import { ExcerptSourcePicker } from "../components/source/ExcerptSourcePicker";

interface ExcerptEditPageProps {
  unitId: string;
  data: UnitFormData;
  setData: (data: UnitFormData) => void;
}

/**
 * 摘录编辑表单组件 - 编辑摘录的标题、来源和内容
 *
 * 布局结构：
 * - 移动端 (<640px)：垂直堆叠，间距 gap-4
 * - 平板 (640-1023px)：垂直堆叠，间距 gap-4
 * - 桌面 (1024-1535px)：垂直堆叠，min-h-[300px] markdown 编辑器
 * - 超宽 (>=1536px)：垂直堆叠，min-h-[300px] markdown 编辑器
 *
 * ASCII 布局示意:
 *
 * All Viewports
 * +----------+
 * |TITLE FLD |
 * +----------+
 * +----------+
 * |SOURCE    |
 * +----------+
 * +----------+
 * |MARKDOWN  |
 * |EDITOR    |
 * |...[300+] |
 * +----------+
 */
export function ExcerptEditPage({
  unitId,
  data,
  setData,
}: ExcerptEditPageProps) {
  const { t } = useTranslation(["common", "community"]);
  const translation = data.translations?.[0];
  const extra = (data.extra as Record<string, any>) ?? {};
  const source = extra.source as ExcerptSource | undefined;

  const { mutate } = useUpdateUnitMutation({
    onSuccess: () => {
      toast.success(t("community:excerpt_updated_success"));
    },
    onError: (error) => {
      toast.error(
        t("community:excerpt_messages_update_failed", { error: String(error) }),
      );
    },
  });

  const { mutate: upsertTranslation } = useUpsertTranslationMutation({
    onError: (error) => {
      toast.error(
        t("community:excerpt_messages_update_failed", { error: String(error) }),
      );
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

    if (translation) {
      upsertTranslation({
        unitId,
        language: translation.language || "en",
        input: {
          title: translation.title,
          description: translation.description,
        },
      });
    }
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
        <Label htmlFor="excerpt-title">
          {t("community:excerpt_form_title")}
        </Label>
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

      <ExcerptSourcePicker value={source} onChange={handleSourceChange} />

      <div className="flex-1 min-h-[300px]">
        <RezicsMarkdownEditor
          value={contentDocMarkdownFallback(translation?.description)}
          onChange={(value) =>
            setData({
              ...data,
              translations: [
                {
                  ...(translation || { language: "en" }),
                  description: markdownContentDoc(value),
                },
              ],
            })
          }
          onSubmit={handleSave}
          submitLabel={t("common:save")}
        />
      </div>
    </div>
  );
}

/**
 * 摘录编辑页面容器 - 从路由参数加载摘录数据并显示编辑表单
 *
 * 布局结构：
 * - 移动端 (<640px)：w-11/12 边距，顶部 mt-4
 * - 平板 (640-1023px)：max-w-4xl 中心，mx-auto
 * - 桌面 (1024-1535px)：max-w-4xl 中心，mx-auto
 * - 超宽 (>=1536px)：max-w-4xl 中心，mx-auto
 *
 * ASCII 布局示意:
 *
 * Mobile (<640px)          Tablet (640-1023px)      Desktop (1024-1535px)    Ultra-wide (>=1536px)
 * +--+                     +------+                  +----------+              +----------+
 * |  | margin              | FORM |                  | FORM     |              | FORM     |
 * |FM|                     +------+                  +----------+              +----------+
 * |  | margin
 * +--+
 */
export function ExcerptEditPageContainer() {
  const { t } = useTranslation(["common", "community"]);
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
    return <div>{t("common:loading")}</div>;
  }
  if (error) {
    return isApiNotFoundError(error) ? (
      <ResourceNotFoundState variant="section" />
    ) : (
      <QueryErrorDisplay error={error} />
    );
  }
  if (!unitData) {
    return <ResourceNotFoundState variant="section" />;
  }

  return (
    <div className="w-full max-w-4xl mx-auto mt-4">
      <ExcerptEditPage
        unitId={unitId}
        data={excerptData}
        setData={setExcerptData}
      />
    </div>
  );
}
