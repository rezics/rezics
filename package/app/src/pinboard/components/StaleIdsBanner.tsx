import CleaningServicesRoundedIcon from "@mui/icons-material/CleaningServicesRounded";
import { Alert, AlertTitle, Button, Stack } from "@mui/material";
import { useRemoveRealmExtraMutation } from "@rezics/api/realm/realm-extra.mutations";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
        t("pinboard.stale.cleanup_partial", {
          failed,
          total: staleIds.length,
        }),
      );
    } else {
      toast.success(t("pinboard.stale.cleanup_done"));
      onCleaned?.();
    }
  };

  return (
    <Alert
      severity="warning"
      action={
        <Stack direction="row" spacing={1}>
          <Button
            size="small"
            variant="outlined"
            startIcon={<CleaningServicesRoundedIcon />}
            onClick={handleCleanup}
            disabled={working}
          >
            {t("pinboard.stale.cleanup")}
          </Button>
          <Button
            size="small"
            color="inherit"
            onClick={() => setDismissed(true)}
            disabled={working}
          >
            {t("common.dismiss")}
          </Button>
        </Stack>
      }
    >
      <AlertTitle>{t("pinboard.stale.title")}</AlertTitle>
      {t("pinboard.stale.description", { count: staleIds.length })}
    </Alert>
  );
};
