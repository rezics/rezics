import { CircularProgress, Typography } from "@mui/material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { authApi } from "@rezics/api/auth/auth.api";
import { Turnstile } from "@rezics/ui/composite/auth/Turnstile.tsx";
import { useNavigate } from "@tanstack/react-router";
import { type FC, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/env";
import { hydrateAuthSessionState } from "@/user/state";
import { Layout } from "../layout/Layout";
import { resolvePostAuthDestination } from "../model/authRedirect";
import { useAuth } from "./useAuth";

export const VerifyEmailPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string>();
  const [turnstileRetryKey, setTurnstileRetryKey] = useState(0);

  const email = auth.authSession?.email ?? "";
  const canResend = useMemo(
    () => Boolean(auth.authenticated && email),
    [auth.authenticated, email],
  );

  const handleRefresh = async () => {
    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const sessionState = await hydrateAuthSessionState();
      if (
        sessionState &&
        !sessionState.authSession.needsEmailVerification &&
        !sessionState.authSession.needsOnboarding
      ) {
        navigate({
          to: resolvePostAuthDestination({
            needsOnboarding: sessionState.authSession.needsOnboarding,
            needsVerification: sessionState.authSession.needsEmailVerification,
          }),
        });
        return;
      }
      setMessage(t("auth.flow.verify_refreshed"));
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError(t("auth.flow.verify_missing_email"));
      return;
    }

    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      if (!turnstileToken) {
        throw new Error(t("auth.flow.verify_complete_widget"));
      }

      await authApi.sendVerificationEmail({ email });
      setMessage(t("auth.flow.verify_sent"));
      setTurnstileToken(undefined);
      setTurnstileReady(false);
      setTurnstileRetryKey((current) => current + 1);
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  if (!auth.authenticated) {
    return (
      <Layout
        title={t("auth.flow.verify_title")}
        content={
          <Alert severity="info">{t("auth.flow.verify_sign_in_first")}</Alert>
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

  if (!auth.needsVerification && !auth.needsOnboarding) {
    return (
      <Layout
        title={t("auth.flow.verify_title")}
        content={
          <Alert severity="success">{t("auth.flow.verify_already_done")}</Alert>
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
      title={t("auth.flow.verify_title")}
      content={
        <>
          {error && <Alert severity="error">{error}</Alert>}
          {message && <Alert severity="success">{message}</Alert>}
          <Typography variant="body1">
            {t("auth.flow.verify_intro_prefix")}{" "}
            <strong>{email || t("auth.flow.verify_email_fallback")}</strong>{" "}
            {t("auth.flow.verify_intro_suffix")}
          </Typography>
          <Turnstile
            key={turnstileRetryKey}
            siteKeyProps={env.VITE_TURNSTILE_SITE_KEY}
            onVerify={(token: string) => {
              setTurnstileToken(token);
              setTurnstileError(undefined);
            }}
            onReady={() => {
              setTurnstileReady(true);
              setTurnstileError(undefined);
            }}
            onError={(caughtError: Error) => {
              setTurnstileReady(false);
              setTurnstileToken(undefined);
              setTurnstileError(caughtError.message);
            }}
            loadingComponent={
              <div className="flex items-center gap-3">
                <CircularProgress size={18} />
                <Typography variant="body2">
                  {t("auth.flow.verify_widget_loading")}
                </Typography>
              </div>
            }
          />
          {turnstileError ? (
            <Alert
              severity="error"
              action={
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => {
                    setTurnstileError(undefined);
                    setTurnstileRetryKey((current) => current + 1);
                  }}
                >
                  {t("auth.flow.retry")}
                </Button>
              }
            >
              {turnstileError}
            </Alert>
          ) : null}
          {!turnstileError && !turnstileReady ? (
            <Alert severity="info">
              {t("auth.flow.verify_widget_required")}
            </Alert>
          ) : null}
          {auth.loading || loading ? (
            <div className="flex items-center gap-3">
              <CircularProgress size={18} />
              <Typography variant="body2">
                {t("auth.flow.verify_checking_state")}
              </Typography>
            </div>
          ) : null}
          <Typography variant="body2" color="text.secondary">
            {t("auth.flow.verify_guest_notice")}
          </Typography>
        </>
      }
      actions={
        <>
          <Button variant="text" disabled={loading} onClick={handleRefresh}>
            {t("auth.flow.verify_refresh")}
          </Button>
          <Button
            variant="contained"
            disabled={
              !canResend || loading || !turnstileReady || !turnstileToken
            }
            onClick={handleResend}
          >
            {t("auth.flow.verify_resend")}
          </Button>
        </>
      }
    />
  );
};
