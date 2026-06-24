import { useAlertStore } from "@app/states/windowAlertStore";
import { useCurrentUserId } from "@rezics/contract/api/hooks";
import { useCreateUnitMutation } from "@rezics/contract/api/unit/unit.mutations";
import type { UnitFormData } from "@rezics/contract/api/unit/unit.types";
import { markdownContentDoc } from "@rezics/contract";
import { useTranslation } from "@rezics/i18n/react";
import { CooldownButton } from "@rezics/ui/composite/button/CooldownButton.tsx";
import { Input, Label } from "@rezics/ui/shadcn";
import { useState } from "react";
import { ExcerptEditPage } from "./ExcerptEditPage";

/**
 * 新建摘录页面 - 允许用户为指定书籍创建新摘录
 *
 * 布局结构：
 * - 移动端 (<640px)：全宽卡片，垂直堆叠
 * - 平板 (640-1023px)：最宽 max-w-4xl，边距 mx-auto
 * - 桌面 (1024-1535px)：最宽 max-w-4xl，居中
 * - 超宽 (>=1536px)：最宽 max-w-4xl，居中
 *
 * ASCII 布局示意:
 *
 * Mobile (<640px)          Tablet (640-1023px)      Desktop (1024-1535px)    Ultra-wide (>=1536px)
 * +--+                     +------+                  +----------+              +----------+
 * |TL|                     |TITLE |                  | TITLE    |              | TITLE    |
 * +--+                     +------+                  +----------+              +----------+
 * |BK|                     |BOOK  |                  |BOOK      |              |BOOK      |
 * +--+                     |      |                  |          |              |          |
 * |FM|                     |FORM  |                  |FORM      |              |FORM      |
 * +--+                     |      |                  |          |              |          |
 * |BT|                     |      |                  |          |              |          |
 * +--+                     |BTN   |                  |BTN       |              |BTN       |
 *
 * TL=Title, BK=BookId, FM=Form, BT=Button
 */
export function ExcerptNewPage({ bookUnitId }: { bookUnitId: string }) {
  const { t } = useTranslation(["auth", "common", "community"]);
  const [excerptData, setExcerptData] = useState<UnitFormData>(
    {} as UnitFormData,
  );
  const { show } = useAlertStore();
  const userId = useCurrentUserId();

  const { mutate, isPending } = useCreateUnitMutation({
    onSuccess: () => {
      show(t("community:excerpt_created_success"));
    },
    onError: (error) => {
      show(t("community:excerpt_create_failed", { error: String(error) }));
    },
  });

  function handleSave() {
    if (!userId) {
      show(t("auth:flow_onboarding_sign_in_first"));
      return;
    }
    const translation = excerptData.translations?.[0];
    mutate({
      userId,
      type: "QUOTE",
      extra: (excerptData.extra as Record<string, any>) || undefined,
      targetUnitId: bookUnitId,
      translations: [
        {
          language: translation?.language || "en",
          title: translation?.title || undefined,
          description: markdownContentDoc(
            String(translation?.description || ""),
          ),
        },
      ],
    });
  }

  return (
    <div>
      <div className="w-full max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">
          {t("community:excerpt_new_title")}
        </h1>
        <div className="flex flex-col gap-1 mt-4">
          <Label htmlFor="book-unit-id">
            {t("community:excerpt_book_unit_id")}
          </Label>
          <Input
            id="book-unit-id"
            className="w-full"
            value={bookUnitId}
            disabled
          />
        </div>
        <ExcerptEditPage
          unitId={""}
          data={excerptData}
          setData={setExcerptData}
        />
        <div className="flex justify-end gap-2">
          <CooldownButton
            cooldownMs={10000}
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? t("common:submitting") : t("common:submit")}
          </CooldownButton>
        </div>
      </div>
    </div>
  );
}
