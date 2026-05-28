import { useSignOutMutation } from "@rezics/api/auth/auth.mutations";
import {
  useDeleteMeMutation,
  useRequestEmailVerificationMutation,
  useVerifyEmailContractMutation,
} from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck as VerifiedIcon } from "lucide-react";
import { type FC, useState } from "react";
import { DangerZone } from "@/user/components/DangerZone";
import { SettingsSection } from "@/user/components/SettingsSection";
import { useRequireAuth } from "@/user/pages/useAuth";

export const SettingsAccountSection: FC = () => {
  const { t } = useTranslation(["common", "settings"]);
  useRequireAuth();
  const { data: emailState, isLoading } = useQuery(
    userQueries.emailVerification(),
  );
  const { data: user } = useQuery(userQueries.me());

  const [newEmail, setNewEmail] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const requestEmailVerification = useRequestEmailVerificationMutation();
  const verifyEmailContract = useVerifyEmailContractMutation();
  const deleteMe = useDeleteMeMutation();
  const signOut = useSignOutMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const currentEmail = emailState?.email ?? "";
  const pendingEmail = emailState?.pendingEmail ?? "";
  const isVerified = emailState?.verified ?? false;

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    requestEmailVerification.mutate(
      { email: newEmail },
      {
        onSuccess: (response) => {
          if (response.success) {
            setEmailSuccess(t("settings:account_rezics_email_code_sent"));
            setNewEmail("");
          }
        },
      },
    );
  };

  const handleResendVerification = () => {
    requestEmailVerification.mutate({ email: pendingEmail || currentEmail });
  };

  const handleVerifyEmail = (e: React.FormEvent) => {
    e.preventDefault();
    verifyEmailContract.mutate(
      { email: pendingEmail || currentEmail, code: verificationCode },
      {
        onSuccess: (response) => {
          if (response.success) {
            setEmailSuccess(t("settings:account_rezics_email_verified"));
            setVerificationCode("");
          }
        },
      },
    );
  };

  const handleDeleteAccount = () => {
    deleteMe.mutate(undefined, {
      onSuccess: () => {
        signOut.mutate();
        window.location.href = "/";
      },
    });
  };

  const slugMatch = deleteConfirm === user?.slug;

  return (
    <div>
      <SettingsSection
        title={t("settings:account_rezics_email_title")}
        description={t("settings:account_rezics_email_description")}
      >
        <div className="flex items-center gap-2 mb-4">
          <p className="text-base">
            {currentEmail || t("settings:account_rezics_email_empty")}
          </p>
          {isVerified ? (
            <Badge
              variant="outline"
              className="text-success-text flex items-center gap-1"
            >
              <VerifiedIcon className="w-3 h-3" />
              {t("settings:account_verified")}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-warning-text">
              {t("settings:account_unverified")}
            </Badge>
          )}
        </div>

        {pendingEmail && pendingEmail !== currentEmail && (
          <p className="text-sm text-text-secondary mb-3">
            {t("settings:account_pending_verification", {
              email: pendingEmail,
            })}
          </p>
        )}

        {(pendingEmail || currentEmail) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={requestEmailVerification.isPending}
            className="gap-2"
          >
            {requestEmailVerification.isPending && <Spinner size="sm" />}
            {requestEmailVerification.isPending
              ? t("settings:account_sending")
              : t("settings:account_send_verification_code")}
          </Button>
        )}

        {requestEmailVerification.data?.success && (
          <Alert className="mt-2 text-success-text" aria-live="polite">
            <AlertDescription>
              {t("settings:account_verification_code_sent")}
            </AlertDescription>
          </Alert>
        )}
        {requestEmailVerification.data?.error && (
          <Alert variant="destructive" className="mt-2" aria-live="assertive">
            <AlertDescription>
              {requestEmailVerification.data.error.message}
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <SettingsSection
        title={t("settings:account_change_rezics_email_title")}
        description={t("settings:account_change_rezics_email_description")}
      >
        {emailSuccess && (
          <Alert className="mb-4 text-success-text" aria-live="polite">
            <AlertDescription>{emailSuccess}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleChangeEmail} className="flex items-end gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="new-email">
              {t("settings:account_new_rezics_email")}
            </Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              required
            />
          </div>
          <Button
            type="submit"
            size="sm"
            disabled={requestEmailVerification.isPending || !newEmail}
            className="gap-2"
          >
            {requestEmailVerification.isPending && <Spinner size="sm" />}
            {requestEmailVerification.isPending
              ? t("settings:account_sending")
              : t("settings:account_send_code")}
          </Button>
        </form>
        {(pendingEmail || currentEmail) && (
          <form
            onSubmit={handleVerifyEmail}
            className="flex items-end gap-3 mt-4"
          >
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="verification-code">
                {t("settings:account_verification_code")}
              </Label>
              <Input
                id="verification-code"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
              />
            </div>
            <Button
              type="submit"
              size="sm"
              disabled={
                verifyEmailContract.isPending ||
                !verificationCode ||
                !(pendingEmail || currentEmail)
              }
            >
              {verifyEmailContract.isPending
                ? t("settings:account_verifying")
                : t("settings:account_verify")}
            </Button>
          </form>
        )}
        {verifyEmailContract.data?.error && (
          <Alert variant="destructive" className="mt-4" aria-live="assertive">
            <AlertDescription>
              {verifyEmailContract.data.error.message}
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <DangerZone description={t("settings:account_delete_warning")}>
        <Button
          variant="outline"
          className="text-error-text"
          onClick={() => setDeleteOpen(true)}
        >
          {t("settings:account_delete_title")}
        </Button>

        <Dialog
          open={deleteOpen}
          onOpenChange={(o) => !o && setDeleteOpen(false)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t("settings:account_delete_title")}</DialogTitle>
            </DialogHeader>
            <p className="text-sm mb-4">
              {t("settings:account_delete_confirm_prefix")}{" "}
              <strong>{user?.slug}</strong>{" "}
              {t("settings:account_delete_confirm_suffix")}
            </p>
            <Input
              placeholder={user?.slug}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoFocus
            />
            {deleteMe.error && (
              <Alert variant="destructive" className="mt-2">
                <AlertDescription>{deleteMe.error.message}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setDeleteOpen(false)}>
                {t("common:cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={!slugMatch || deleteMe.isPending}
                onClick={handleDeleteAccount}
              >
                {deleteMe.isPending
                  ? t("settings:account_deleting")
                  : t("settings:account_delete_my_account")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DangerZone>
    </div>
  );
};
