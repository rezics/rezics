import {
  Alert,
  Button,
  Checkbox,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  FormControlLabel,
  Stack,
  Typography,
} from "@mui/material";
import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import type { ContentRating } from "@rezics/contract";
import { RatingBadge } from "@rezics/ui";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { useTranslation } from "react-i18next";

type OptInRating = "R_18" | "R_18G";
const OPT_IN_RATINGS: OptInRating[] = ["R_18", "R_18G"];
const BASELINE_RATINGS: ContentRating[] = ["GENERAL", "R_15"];

export const ContentRatingPreferences: FC = () => {
  const { t } = useTranslation();
  const { data: settings } = useQuery(userQueries.settings());
  const updateSettings = useUpdateSettingsMutation();

  const optedIn: OptInRating[] =
    (settings?.content?.optedInRatings as OptInRating[] | undefined) ?? [];
  const [confirming, setConfirming] = useState<OptInRating | null>(null);
  const [saved, setSaved] = useState(false);

  const persist = (next: OptInRating[]) => {
    updateSettings.mutate(
      { content: { optedInRatings: next } },
      {
        onSuccess: () => {
          setSaved(true);
          setTimeout(() => setSaved(false), 2000);
        },
      },
    );
  };

  const handleToggle = (rating: OptInRating, checked: boolean) => {
    if (checked) {
      setConfirming(rating);
      return;
    }
    persist(optedIn.filter((r) => r !== rating));
  };

  const confirmOptIn = () => {
    if (!confirming) return;
    if (optedIn.includes(confirming)) {
      setConfirming(null);
      return;
    }
    persist([...optedIn, confirming]);
    setConfirming(null);
  };

  return (
    <>
      {saved && (
        <Alert severity="success" className="mb-3">
          {t("settings.content_rating.saved", "Preferences saved.")}
        </Alert>
      )}

      <Stack spacing={1.5}>
        {BASELINE_RATINGS.map((rating) => (
          <div
            key={rating}
            className="flex items-center justify-between gap-2"
          >
            <FormControlLabel
              control={<Checkbox checked disabled />}
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <RatingBadge rating={rating} />
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      "settings.content_rating.always_on",
                      "Always on",
                    )}
                  </Typography>
                </Stack>
              }
            />
          </div>
        ))}

        {OPT_IN_RATINGS.map((rating) => (
          <div
            key={rating}
            className="flex items-center justify-between gap-2"
          >
            <FormControlLabel
              control={
                <Checkbox
                  checked={optedIn.includes(rating)}
                  onChange={(e) => handleToggle(rating, e.target.checked)}
                  disabled={updateSettings.isPending}
                />
              }
              label={
                <Stack direction="row" spacing={1} alignItems="center">
                  <RatingBadge rating={rating} />
                  <Typography variant="body2" color="text.secondary">
                    {t(
                      `settings.content_rating.description.${rating}`,
                      rating === "R_18"
                        ? "Adult content."
                        : "Explicit adult content.",
                    )}
                  </Typography>
                </Stack>
              }
            />
          </div>
        ))}
      </Stack>

      <Dialog open={confirming !== null} onClose={() => setConfirming(null)}>
        <DialogTitle>
          {t(
            "settings.content_rating.opt_in_modal.title",
            "Confirm age-restricted content",
          )}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {t(
              "settings.content_rating.opt_in_modal.body",
              "By enabling {{rating}} you confirm you are of legal age in your jurisdiction and consent to viewing this content.",
              { rating: confirming ?? "" },
            )}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConfirming(null)}>
            {t("common.cancel", "Cancel")}
          </Button>
          <Button variant="contained" onClick={confirmOptIn}>
            {t(
              "settings.content_rating.opt_in_modal.confirm",
              "I confirm",
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
