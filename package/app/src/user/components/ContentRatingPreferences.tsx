import { useUpdateSettingsMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import type { ContentRating } from "@rezics/contract";
import { RatingBadge } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { type FC, useState } from "react";
import { useMessage } from "@rezics/i18n/react";
import {
  common_cancel,
  settings_content_rating_always_on,
  settings_content_rating_opt_in_modal_body,
  settings_content_rating_opt_in_modal_confirm,
  settings_content_rating_opt_in_modal_title,
  settings_content_rating_saved,
  settings_content_rating_description_R_18,
  settings_content_rating_description_R_18G,
} from "@rezics/i18n/messages";
const m = {
  common_cancel,
  settings_content_rating_always_on,
  settings_content_rating_opt_in_modal_body,
  settings_content_rating_opt_in_modal_confirm,
  settings_content_rating_opt_in_modal_title,
  settings_content_rating_saved,
  settings_content_rating_description_R_18,
  settings_content_rating_description_R_18G,
};

const i18nMessages = {
  common_cancel,
  settings_content_rating_always_on,
  settings_content_rating_opt_in_modal_body,
  settings_content_rating_opt_in_modal_confirm,
  settings_content_rating_opt_in_modal_title,
  settings_content_rating_saved,
  settings_content_rating_description_R_18,
  settings_content_rating_description_R_18G,
};

type OptInRating = "R_18" | "R_18G";
const OPT_IN_RATINGS: OptInRating[] = ["R_18", "R_18G"];
const BASELINE_RATINGS: ContentRating[] = ["GENERAL", "R_15"];

const OPT_IN_RATING_DESCRIPTION = {
  R_18: m.settings_content_rating_description_R_18,
  R_18G: m.settings_content_rating_description_R_18G,
} as const satisfies Record<OptInRating, () => string>;

export const ContentRatingPreferences: FC = () => {
  const m = useMessage(i18nMessages);
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
        <Alert className="mb-3 text-success-text">
          <AlertDescription>
            {m.settings_content_rating_saved()}
          </AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-3">
        {BASELINE_RATINGS.map((rating) => (
          <div key={rating} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox checked disabled aria-label={rating} />
              <span className="flex flex-row items-center gap-2">
                <RatingBadge rating={rating} />
                <span className="text-sm text-text-secondary">
                  {m.settings_content_rating_always_on()}
                </span>
              </span>
            </div>
          </div>
        ))}

        {OPT_IN_RATINGS.map((rating) => (
          <div key={rating} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Checkbox
                checked={optedIn.includes(rating)}
                onCheckedChange={(checked) =>
                  handleToggle(rating, checked === true)
                }
                disabled={updateSettings.isPending}
                aria-label={rating}
              />
              <span className="flex flex-row items-center gap-2">
                <RatingBadge rating={rating} />
                <span className="text-sm text-text-secondary">
                  {OPT_IN_RATING_DESCRIPTION[rating]()}
                </span>
              </span>
            </div>
          </div>
        ))}
      </div>

      <Dialog
        open={confirming !== null}
        onOpenChange={(o) => !o && setConfirming(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {m.settings_content_rating_opt_in_modal_title()}
            </DialogTitle>
            <DialogDescription>
              {m.settings_content_rating_opt_in_modal_body({
                rating: confirming ?? "",
              })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(null)}>
              {m.common_cancel()}
            </Button>
            <Button onClick={confirmOptIn}>
              {m.settings_content_rating_opt_in_modal_confirm()}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};
