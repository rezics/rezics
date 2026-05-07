import { useSignOutMutation } from "@rezics/api/auth/auth.mutations";
import {
  useDeleteMeMutation,
  useRequestEmailVerificationMutation,
  useVerifyEmailContractMutation,
} from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
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
            setEmailSuccess(
              "A verification code has been sent to your Rezics email.",
            );
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
            setEmailSuccess("Rezics email verified.");
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
        title="Rezics Email"
        description="Manage the product email shown in Rezics. Login email belongs in Security."
      >
        <div className="flex items-center gap-2 mb-4">
          <p className="text-base">
            {currentEmail || "No verified Rezics email"}
          </p>
          {isVerified ? (
            <Badge
              variant="outline"
              className="text-success-text flex items-center gap-1"
            >
              <VerifiedIcon className="w-3 h-3" />
              Verified
            </Badge>
          ) : (
            <Badge variant="outline" className="text-warning-text">
              Unverified
            </Badge>
          )}
        </div>

        {pendingEmail && pendingEmail !== currentEmail && (
          <p className="text-sm text-text-secondary mb-3">
            Pending verification: {pendingEmail}
          </p>
        )}

        {(pendingEmail || currentEmail) && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={requestEmailVerification.isPending}
          >
            {requestEmailVerification.isPending
              ? "Sending..."
              : "Send Verification Code"}
          </Button>
        )}

        {requestEmailVerification.data?.success && (
          <Alert className="mt-2 text-success-text">
            <AlertDescription>Verification code sent.</AlertDescription>
          </Alert>
        )}
        {requestEmailVerification.data?.error && (
          <Alert variant="destructive" className="mt-2">
            <AlertDescription>
              {requestEmailVerification.data.error.message}
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <SettingsSection
        title="Change Rezics Email"
        description="A code will be sent to the new address. Your current Rezics email stays unchanged until verification succeeds."
      >
        {emailSuccess && (
          <Alert className="mb-4 text-success-text">
            <AlertDescription>{emailSuccess}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleChangeEmail} className="flex items-end gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="new-email">New Rezics Email</Label>
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
          >
            {requestEmailVerification.isPending ? "Sending..." : "Send Code"}
          </Button>
        </form>
        {(pendingEmail || currentEmail) && (
          <form
            onSubmit={handleVerifyEmail}
            className="flex items-end gap-3 mt-4"
          >
            <div className="flex-1 flex flex-col gap-1.5">
              <Label htmlFor="verification-code">Verification Code</Label>
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
              {verifyEmailContract.isPending ? "Verifying..." : "Verify"}
            </Button>
          </form>
        )}
        {verifyEmailContract.data?.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertDescription>
              {verifyEmailContract.data.error.message}
            </AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <DangerZone description="Once you delete your account, there is no going back. Please be certain.">
        <Button
          variant="outline"
          className="text-error-text"
          onClick={() => setDeleteOpen(true)}
        >
          Delete Account
        </Button>

        <Dialog
          open={deleteOpen}
          onOpenChange={(o) => !o && setDeleteOpen(false)}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Account</DialogTitle>
            </DialogHeader>
            <p className="text-sm mb-4">
              This action is permanent and cannot be undone. To confirm, type
              your username <strong>{user?.slug}</strong> below.
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
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={!slugMatch || deleteMe.isPending}
                onClick={handleDeleteAccount}
              >
                {deleteMe.isPending ? "Deleting..." : "Delete My Account"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DangerZone>
    </div>
  );
};
