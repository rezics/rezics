import {
  useChangeEmailMutation,
  useSendVerificationEmailMutation,
  useSignOutMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import { useDeleteMeMutation } from "@rezics/api/user/user.mutations";
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

  const { data: sessionState, isLoading } = useQuery(
    authQueries.sessionState(),
  );
  const { data: user } = useQuery(userQueries.me());

  const [newEmail, setNewEmail] = useState("");
  const [emailSuccess, setEmailSuccess] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const changeEmail = useChangeEmailMutation();
  const sendVerification = useSendVerificationEmailMutation();
  const deleteMe = useDeleteMeMutation();
  const signOut = useSignOutMutation();

  if (isLoading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const authSession = sessionState?.authSession;
  const currentEmail = authSession?.email ?? "";
  const isVerified = authSession?.emailVerified ?? false;

  const handleChangeEmail = (e: React.FormEvent) => {
    e.preventDefault();
    changeEmail.mutate(
      { newEmail },
      {
        onSuccess: () => {
          setEmailSuccess(
            "A verification email has been sent to your new address.",
          );
          setNewEmail("");
        },
      },
    );
  };

  const handleResendVerification = () => {
    sendVerification.mutate({ email: currentEmail });
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
        title="Email Address"
        description="Manage your email address and verification status."
      >
        <div className="flex items-center gap-2 mb-4">
          <p className="text-base">{currentEmail}</p>
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

        {!isVerified && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleResendVerification}
            disabled={sendVerification.isPending}
          >
            {sendVerification.isPending ? "Sending..." : "Resend Verification"}
          </Button>
        )}

        {sendVerification.isSuccess && (
          <Alert className="mt-2 text-success-text">
            <AlertDescription>Verification email sent.</AlertDescription>
          </Alert>
        )}
      </SettingsSection>

      <SettingsSection
        title="Change Email"
        description="Update your email address. A verification link will be sent to the new address."
      >
        {emailSuccess && (
          <Alert className="mb-4 text-success-text">
            <AlertDescription>{emailSuccess}</AlertDescription>
          </Alert>
        )}
        {changeEmail.error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{changeEmail.error.message}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleChangeEmail} className="flex items-end gap-3">
          <div className="flex-1 flex flex-col gap-1.5">
            <Label htmlFor="new-email">New Email</Label>
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
            disabled={changeEmail.isPending || !newEmail}
          >
            {changeEmail.isPending ? "Updating..." : "Change Email"}
          </Button>
        </form>
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
