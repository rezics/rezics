import { useAlertStore } from "@app/states/windowAlertStore";
import { TextField } from "@mui/material";
import { useCreateUnitMutation } from "@rezics/api/unit/unit.mutations";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import { CooldownButton } from "@rezics/ui/composite/button/CooldownButton.tsx";
import { useState } from "react";
import { useUserProfileStore } from "@/user/states";
import { ExcerptEditPage } from "./ExcerptEditPage";

export function ExcerptNewPage({ bookUnitId }: { bookUnitId: string }) {
  const [excerptData, setExcerptData] = useState<UnitFormData>(
    {} as UnitFormData,
  );
  const { show } = useAlertStore();
  const { user } = useUserProfileStore();

  const { mutate, isPending } = useCreateUnitMutation({
    onSuccess: (data) => {
      show("Excerpt created successfully");
      console.log("create excerpt success", data);
    },
    onError: (error) => {
      show(`Create excerpt failed: ${error}`);
      console.error("create excerpt failed", error);
    },
  });

  function handleSave() {
    const userId = user?.unitId as string;
    if (!userId) {
      show("Please login first");
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
          description: translation?.description || "",
        },
      ],
    });
  }

  return (
    <div>
      <div className="max-w-4xl mx-auto mt-4">
        <h1 className="text-xl font-semibold">New Excerpt</h1>
        <TextField
          label="Book Unit ID"
          variant="filled"
          className="w-full !mt-4"
          value={bookUnitId}
          disabled
        />
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
            {isPending ? "Submitting..." : "Submit"}
          </CooldownButton>
        </div>
      </div>
    </div>
  );
}
