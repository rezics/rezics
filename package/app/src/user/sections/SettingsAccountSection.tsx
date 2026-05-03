import VerifiedIcon from "@mui/icons-material/Verified";
import {
  Alert,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
} from "@mui/material";
import {
  useChangeEmailMutation,
  useSendVerificationEmailMutation,
  useSignOutMutation,
} from "@rezics/api/auth/auth.mutations";
import { authQueries } from "@rezics/api/auth/auth.queries";
import { useDeleteMeMutation } from "@rezics/api/user/user.mutations";
import { userQueries } from "@rezics/api/user/user.queries";
import { useQuery } from "@tanstack/react-query";
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
        <CircularProgress />
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
          <Typography variant="body1">{currentEmail}</Typography>
          {isVerified ? (
            <Chip
              icon={<VerifiedIcon />}
              label="Verified"
              size="small"
              color="success"
              variant="outlined"
            />
          ) : (
            <Chip
              label="Unverified"
              size="small"
              color="warning"
              variant="outlined"
            />
          )}
        </div>

        {!isVerified && (
          <Button
            variant="outlined"
            size="small"
            onClick={handleResendVerification}
            disabled={sendVerification.isPending}
          >
            {sendVerification.isPending ? "Sending..." : "Resend Verification"}
          </Button>
        )}

        {sendVerification.isSuccess && (
          <Alert severity="success" className="mt-2">
            Verification email sent.
          </Alert>
        )}
      </SettingsSection>

      <SettingsSection
        title="Change Email"
        description="Update your email address. A verification link will be sent to the new address."
      >
        {emailSuccess && (
          <Alert severity="success" className="mb-4">
            {emailSuccess}
          </Alert>
        )}
        {changeEmail.error && (
          <Alert severity="error" className="mb-4">
            {changeEmail.error.message}
          </Alert>
        )}
        <form onSubmit={handleChangeEmail} className="flex items-end gap-3">
          <TextField
            label="New Email"
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            variant="standard"
            required
            className="flex-1"
          />
          <Button
            type="submit"
            variant="contained"
            size="small"
            disabled={changeEmail.isPending || !newEmail}
          >
            {changeEmail.isPending ? "Updating..." : "Change Email"}
          </Button>
        </form>
      </SettingsSection>

      <DangerZone description="Once you delete your account, there is no going back. Please be certain.">
        <Button
          variant="outlined"
          color="error"
          onClick={() => setDeleteOpen(true)}
        >
          Delete Account
        </Button>

        <Dialog open={deleteOpen} onClose={() => setDeleteOpen(false)}>
          <DialogTitle>Delete Account</DialogTitle>
          <DialogContent>
            <Typography variant="body2" className="mb-4">
              This action is permanent and cannot be undone. To confirm, type
              your username <strong>{user?.slug}</strong> below.
            </Typography>
            <TextField
              fullWidth
              variant="standard"
              placeholder={user?.slug}
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              autoFocus
            />
            {deleteMe.error && (
              <Alert severity="error" className="mt-2">
                {deleteMe.error.message}
              </Alert>
            )}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteOpen(false)}>Cancel</Button>
            <Button
              variant="contained"
              color="error"
              disabled={!slugMatch || deleteMe.isPending}
              onClick={handleDeleteAccount}
            >
              {deleteMe.isPending ? "Deleting..." : "Delete My Account"}
            </Button>
          </DialogActions>
        </Dialog>
      </DangerZone>
    </div>
  );
};
