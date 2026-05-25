import { useAlertStore } from "@app/states/windowAlertStore";
import { useCurrentUserId } from "@rezics/api/hooks";
import { useCreateUnitMutation } from "@rezics/api/unit/unit.mutations";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import { markdownContentDoc } from "@rezics/contract";
import {
  auth_flow_onboarding_sign_in_first,
  common_submit,
  common_submitting,
  excerpt_book_unit_id,
  excerpt_create_failed,
  excerpt_created_success,
  excerpt_new_title,
} from "@rezics/i18n/messages";
import { useMessage } from "@rezics/i18n/react";
import { CooldownButton } from "@rezics/ui/composite/button/CooldownButton.tsx";
import { Input, Label } from "@rezics/ui/shadcn";
import { useState } from "react";
import { ExcerptEditPage } from "./ExcerptEditPage";

const i18nMessages = {
  auth_flow_onboarding_sign_in_first,
  common_submit,
  common_submitting,
  excerpt_book_unit_id,
  excerpt_create_failed,
  excerpt_created_success,
  excerpt_new_title,
};

export function ExcerptNewPage({ bookUnitId }: { bookUnitId: string }) {
  const m = useMessage(i18nMessages);
  const [excerptData, setExcerptData] = useState<UnitFormData>(
    {} as UnitFormData,
  );
  const { show } = useAlertStore();
  const userId = useCurrentUserId();

  const { mutate, isPending } = useCreateUnitMutation({
    onSuccess: (data) => {
      show(m.excerpt_created_success());
      console.log("create excerpt success", data);
    },
    onError: (error) => {
      show(m.excerpt_create_failed({ error: String(error) }));
      console.error("create excerpt failed", error);
    },
  });

  function handleSave() {
    if (!userId) {
      show(m.auth_flow_onboarding_sign_in_first());
      return;
    }
    const translation = excerptData.translations?.[0];
    mutate({
      userId,
      type: "QUOTE",
      extra: (excerptData.extra as Record<string, any>) || undefined,
      workUnitId: bookUnitId,
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
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">{m.excerpt_new_title()}</h1>
        <div className="flex flex-col gap-1 mt-4">
          <Label htmlFor="book-unit-id">{m.excerpt_book_unit_id()}</Label>
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
          targetUnitId={bookUnitId}
        />
        <div className="flex justify-end gap-2">
          <CooldownButton
            cooldownMs={10000}
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            disabled={isPending}
          >
            {isPending ? m.common_submitting() : m.common_submit()}
          </CooldownButton>
        </div>
      </div>
    </div>
  );
}
