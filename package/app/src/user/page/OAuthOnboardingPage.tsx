import { Typography } from "@mui/material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { authApi } from "@rezics/api/auth/auth.api";
import { OptionalPasswordField } from "@rezics/ui/composite/auth/OptionalPasswordField.tsx";
import { TrustedEmailField } from "@rezics/ui/composite/auth/TrustedEmailField.tsx";
import { useNavigate } from "@tanstack/react-router";
import { type FC, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { hydrateAuthSessionState } from "@/user/state";
import { Layout } from "../layout/Layout";
import { resolvePostAuthDestination } from "../model/authRedirect";
import { validateEmail, validatePassword } from "../model/validate";
import { useAuth } from "./useAuth";

export const OAuthOnboardingPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [email, setEmail] = useState(auth.authSession?.email ?? "");
  const [password, setPassword] = useState("");
  const [emailLocked, setEmailLocked] = useState(
    Boolean(auth.authSession?.trustedProviderId),
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [message, setMessage] = useState<string>();

  useEffect(() => {
    setEmail(auth.authSession?.email ?? "");
    setEmailLocked(Boolean(auth.authSession?.trustedProviderId));
  }, [auth.authSession?.email, auth.authSession?.trustedProviderId]);

  const isOAuthSession = useMemo(
    () => Boolean((auth.authSession?.providerIds?.length ?? 0) > 0),
    [auth.authSession?.providerIds],
  );

  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const currentEmail = auth.authSession?.email ?? "";
      const nextEmail = email.trim();

      if (!nextEmail) {
        throw new Error(t("auth.error.email_required"));
      }

      const emailValidation = validateEmail(nextEmail);
      if (!emailValidation.valid) {
        throw new Error(emailValidation.error ?? t("auth.error.invalid_email"));
      }

      if (nextEmail !== currentEmail) {
        await authApi.changeEmail({ newEmail: nextEmail });
      }

      if (password.trim()) {
        const passwordValidation = validatePassword(password);
        if (!passwordValidation.valid) {
          throw new Error(
            passwordValidation.error ?? t("auth.error.invalid_password"),
          );
        }
        await authApi.setPassword({ newPassword: password });
      }

      const sessionState = await hydrateAuthSessionState();
      if (sessionState) {
        navigate({
          to: resolvePostAuthDestination({
            needsOnboarding: sessionState.authSession.needsOnboarding,
            needsVerification: sessionState.authSession.needsEmailVerification,
          }),
        });
        return;
      }

      setMessage(t("auth.flow.onboarding_saved"));
      navigate({ to: "/" });
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.authenticated) {
    return (
      <Layout
        title={t("auth.flow.onboarding_title")}
        content={
          <Alert severity="info">
            {t("auth.flow.onboarding_sign_in_first")}
          </Alert>
        }
        actions={
          <Button
            variant="contained"
            onClick={() => navigate({ to: "/login" })}
          >
            {t("auth.login")}
          </Button>
        }
      />
    );
  }

  if (!isOAuthSession) {
    return (
      <Layout
        title={t("auth.flow.onboarding_title")}
        content={
          <Alert severity="info">{t("auth.flow.onboarding_social_only")}</Alert>
        }
        actions={
          <Button variant="contained" onClick={() => navigate({ to: "/" })}>
            {t("common.continue")}
          </Button>
        }
      />
    );
  }

  if (!auth.needsOnboarding) {
    return (
      <Layout
        title={t("auth.flow.onboarding_title")}
        content={
          <Alert severity="success">{t("auth.flow.onboarding_complete")}</Alert>
        }
        actions={
          <Button
            variant="contained"
            onClick={() =>
              navigate({
                to: resolvePostAuthDestination({
                  needsOnboarding: auth.needsOnboarding,
                  needsVerification: auth.needsVerification,
                  readyForApp: auth.readyForApp,
                }),
              })
            }
          >
            {t("common.continue")}
          </Button>
        }
      />
    );
  }

  return (
    <Layout
      title={t("auth.flow.onboarding_title")}
      content={
        <>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          <Typography variant="body2" color="text.secondary">
            {t("auth.flow.onboarding_intro")}
          </Typography>
          <TrustedEmailField
            value={email}
            locked={emailLocked}
            onChange={setEmail}
            onUnlock={() => setEmailLocked(false)}
            lockedHelperText={t("auth.flow.onboarding_trusted_email")}
            editableHelperText={t("auth.flow.onboarding_editable_email")}
          />
          <OptionalPasswordField
            value={password}
            setValue={setPassword}
            helperText={t("auth.flow.onboarding_optional_password")}
            note={t("auth.flow.onboarding_optional_password")}
          />
        </>
      }
      actions={
        <Button variant="contained" disabled={loading} onClick={handleSubmit}>
          {loading
            ? t("auth.flow.onboarding_saving")
            : t("auth.flow.onboarding_submit")}
        </Button>
      }
    />
  );
};
