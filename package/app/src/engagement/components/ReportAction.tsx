import { useCreateRealmQueueItemMutation } from "@rezics/api/governance/governance";
import { useTranslation } from "@rezics/i18n/react";
import {
  Button,
  buttonVariants,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Label,
  Textarea,
} from "@rezics/ui/shadcn";
import { CheckCircle2, Flag } from "lucide-react";
import type React from "react";
import { useId, useState } from "react";
import { PolicyDenialNotice } from "@/policy";
import { policyDenialFromError } from "@/policy/models/policyDenial";
import { TextLink } from "@/shared/ui/link";
import { cn } from "@/shared/utils/css-util";
import { selectHasMemberSession, useAuthSessionStore } from "@/user/states";

export interface ReportTarget {
  /** Moderation target discriminator, e.g. `"post"`, `"review"`, `"unit"`. */
  kind: string;
  /** Stable id of the reported entity. */
  id: string;
  /** Backing Unit id when the target is Unit-shaped. */
  unitId?: string | null;
  /** The reported user, when applicable. */
  subjectUserId?: string | null;
}

export interface ReportActionProps {
  target: ReportTarget;
  /**
   * Realm the report is filed against. Reports route to the realm moderation
   * queue, so a realm context is required; surfaces without one should not
   * render the action.
   */
  realmUnitId: string;
  /** Optional override for the trigger button label visibility. */
  showLabel?: boolean;
  className?: string;
}

/**
 * Report entry point backed by the realm moderation queue
 * (`useCreateRealmQueueItemMutation`). This is moderation, not product
 * feedback — it intentionally does not reuse `feedback/FeedbackDialog`.
 *
 * States: signed-out (prompts sign-in), allowed (reason form), rate-limited or
 * otherwise denied (inline `PolicyDenialNotice`), and submitted (confirmation).
 */
export const ReportAction: React.FC<ReportActionProps> = ({
  target,
  realmUnitId,
  showLabel = true,
  className,
}) => {
  const { t } = useTranslation(["community"]);
  const isAuthenticated = useAuthSessionStore(selectHasMemberSession);
  const reasonFieldId = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const mutation = useCreateRealmQueueItemMutation({
    onSuccess: () => setSubmitted(true),
  });

  const denial = policyDenialFromError(mutation.error);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Reset transient state when the dialog fully closes.
      setReason("");
      setSubmitted(false);
      mutation.reset();
    }
  };

  const handleSubmit = () => {
    mutation.mutate({
      realmUnitId,
      input: {
        targetKind: target.kind,
        targetId: target.id,
        subjectUserId: target.subjectUserId ?? undefined,
        reason: reason.trim() || undefined,
      },
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn("gap-1.5", className)}
        onClick={() => handleOpenChange(true)}
      >
        <Flag className="h-4 w-4" aria-hidden="true" />
        {showLabel ? t("community:report_action") : null}
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("community:report_dialog_title")}</DialogTitle>
            <DialogDescription>
              {t("community:report_dialog_description")}
            </DialogDescription>
          </DialogHeader>

          {!isAuthenticated ? (
            <div className="flex flex-col gap-4 pt-2">
              <p className="text-sm leading-body text-text-secondary">
                {t("community:report_signin_prompt")}
              </p>
              <TextLink
                to="/login"
                className={cn(
                  buttonVariants({ variant: "default" }),
                  "no-underline",
                )}
              >
                {t("common:sign_in")}
              </TextLink>
            </div>
          ) : submitted ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CheckCircle2
                className="h-10 w-10 text-success-text"
                aria-hidden="true"
              />
              <p className="m-0 text-base font-medium text-text-primary">
                {t("community:report_success_title")}
              </p>
              <p className="m-0 text-sm leading-body text-text-secondary">
                {t("community:report_success_description")}
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-3 pt-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor={reasonFieldId}>
                  {t("community:report_reason_label")}
                </Label>
                <Textarea
                  id={reasonFieldId}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder={t("community:report_reason_placeholder")}
                  rows={4}
                />
              </div>
              <PolicyDenialNotice denial={denial} />
            </div>
          )}

          {isAuthenticated && !submitted ? (
            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => handleOpenChange(false)}
              >
                {t("common:cancel")}
              </Button>
              <Button
                type="button"
                variant="default"
                disabled={mutation.isPending}
                onClick={handleSubmit}
              >
                {mutation.isPending
                  ? t("community:report_submitting")
                  : t("community:report_submit")}
              </Button>
            </DialogFooter>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};
