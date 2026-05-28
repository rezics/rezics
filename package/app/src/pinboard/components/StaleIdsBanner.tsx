import { useRemoveRealmExtraMutation } from "@rezics/api/realm/realm-extra.mutations";
import { useTranslation } from "@rezics/i18n/react";
import { Alert, AlertDescription, AlertTitle, Button } from "@rezics/ui/shadcn";
import { Brush as CleaningServicesRoundedIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { PinboardListKey } from "../models/types";

interface StaleIdsBannerProps {
  realmUnitId: string;
  pinboardKey: PinboardListKey;
  staleIds: string[];
  onCleaned?: () => void;
}

export const StaleIdsBanner: React.FC<StaleIdsBannerProps> = ({
  realmUnitId,
  pinboardKey,
  staleIds,
  onCleaned,
}) => {
  const { t } = useTranslation(["common", "entity"]);
  const [dismissed, setDismissed] = useState(false);
  const [working, setWorking] = useState(false);
  const remove = useRemoveRealmExtraMutation();

  if (dismissed || staleIds.length === 0) return null;

  const handleCleanup = async () => {
    setWorking(true);
    let failed = 0;
    for (const unitId of staleIds) {
      try {
        await remove.mutateAsync({
          realmId: realmUnitId,
          key: pinboardKey,
          unitId,
        });
      } catch {
        failed += 1;
      }
    }
    setWorking(false);
    if (failed > 0) {
      toast.error(
        t("entity:pinboard_stale_cleanup_partial", {
          failed,
          total: staleIds.length,
        }),
      );
    } else {
      toast.success(t("entity:pinboard_stale_cleanup_done"));
      onCleaned?.();
    }
  };

  return (
    <Alert
      variant="default"
      className="border-warning-fill/40 bg-warning-fill/10"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <AlertTitle>{t("entity:pinboard_stale_title")}</AlertTitle>
          <AlertDescription>
            {t("entity:pinboard_stale_description", { count: staleIds.length })}
          </AlertDescription>
        </div>
        <div className="flex flex-row gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCleanup}
            disabled={working}
          >
            <CleaningServicesRoundedIcon className="h-4 w-4 mr-1" />
            {t("entity:pinboard_stale_cleanup")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setDismissed(true)}
            disabled={working}
          >
            {t("common:dismiss")}
          </Button>
        </div>
      </div>
    </Alert>
  );
};
