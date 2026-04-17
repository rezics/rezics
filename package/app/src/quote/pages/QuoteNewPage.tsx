import { useAlertStore } from "@app/states/windowAlertStore";
import { TextField } from "@mui/material";
import { useCreateUnitMutation } from "@rezics/api/unit/unit.mutations";
import type { UnitFormData } from "@rezics/api/unit/unit.types";
import { CooldownButton } from "@rezics/ui/composite/button/CooldownButton.tsx";
import { useState } from "react";
import { useUserProfileStore } from "@/user/states";
import { QuoteEditPage } from "./QuoteEditPage";

export function QuoteNewPage({ bookUnitId }: { bookUnitId: string }) {
  const [quoteData, setQuoteData] = useState<UnitFormData>({} as UnitFormData);
  const { show } = useAlertStore();
  const { user } = useUserProfileStore();

  const { mutate, isPending } = useCreateUnitMutation({
    onSuccess: (data) => {
      show("Quote created successfully");
      console.log("create quote success", data);
    },
    onError: (error) => {
      show(`Create quote failed: ${error}`);
      console.error("create quote failed", error);
    },
  });

  function handleSave() {
    const userId = user?.unitId as string;
    if (!userId) {
      show("Please login first");
      return;
    }
    const translation = quoteData.translations?.[0];
    mutate({
      userId,
      type: "QUOTE",
      extra: {
        ...((quoteData.extra as Record<string, any>) || {}),
        source: (quoteData.extra as Record<string, any>)?.source || "",
      },
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
        <h1 className="text-xl font-semibold">New Quote</h1>
        <TextField
          label="Book Unit ID"
          variant="filled"
          className="w-full !mt-4"
          value={bookUnitId}
          disabled
        />
        <QuoteEditPage unitId={""} data={quoteData} setData={setQuoteData} />
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
