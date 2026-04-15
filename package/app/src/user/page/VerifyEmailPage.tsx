import { CircularProgress, Divider, Typography } from "@mui/material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { authApi } from "@rezics/api/auth/auth.api";
import {
  exchangeForSessionToken,
  queryAccessToken,
} from "@rezics/api/react-query/jwt";
import { Turnstile } from "@rezics/ui/composite/auth/Turnstile.tsx";
import { useNavigate } from "@tanstack/react-router";
import { type FC, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/env";
import { logout } from "@/user/model/handler";
import { hydrateAuthSessionState } from "@/user/state";
import { OtpInput } from "../component/OtpInput";
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
  const [otpCode, setOtpCode] = useState("");
  const [codeSent, setCodeSent] = useState(() => {
    const stored = localStorage.getItem("verify-cooldown-end");
    return stored ? Number(stored) > Date.now() : false;
  });
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [turnstileReady, setTurnstileReady] = useState(false);
  const [turnstileError, setTurnstileError] = useState<string>();
  const [cooldownEnd, setCooldownEnd] = useState<number | null>(() => {
    const stored = localStorage.getItem("verify-cooldown-end");
    if (!stored) return null;
    const ts = Number(stored);
    return ts > Date.now() ? ts : null;
  });
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  const cooldownRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!cooldownEnd) {
      setCooldownRemaining(0);
      return;
    }

    const tick = () => {
      const remaining = Math.ceil((cooldownEnd - Date.now()) / 1000);
      if (remaining <= 0) {
        setCooldownRemaining(0);
        setCooldownEnd(null);
        localStorage.removeItem("verify-cooldown-end");
        clearInterval(cooldownRef.current);
      } else {
        setCooldownRemaining(remaining);
      }
    };

    tick();
    cooldownRef.current = setInterval(tick, 1000);
    return () => clearInterval(cooldownRef.current);
  }, [cooldownEnd]);

  const email = auth.authSession?.email ?? "";
  const canSend = useMemo(
    () =>
      Boolean(
        email &&
          !loading &&
          !cooldownRemaining &&
          (codeSent || (turnstileReady && turnstileToken)),
      ),
    [email, loading, cooldownRemaining, codeSent, turnstileReady, turnstileToken],
  );

  const handleSendCode = async () => {
    if (!email) {
      setError(t("auth.flow.verify_missing_email"));
      return;
    }

    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      if (!codeSent && !turnstileToken) {
        throw new Error(t("auth.flow.verify_complete_widget"));
      }

      await authApi.sendVerificationOTP({
        email,
        type: "email-verification",
        ...(turnstileToken && { turnstileToken }),
      });
      setMessage(t("auth.flow.verify_sent"));
      setCodeSent(true);
      const end = Date.now() + 60_000;
      setCooldownEnd(end);
      localStorage.setItem("verify-cooldown-end", String(end));
    } catch (caughtError) {
      setError((caughtError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (otpCode.length !== 6) {
      setError(t("auth.flow.verify_code_incomplete"));
      return;
    }

    setLoading(true);
    setError(undefined);
    setMessage(undefined);

    try {
      const result = await authApi.verifyEmailOTP({ email, otp: otpCode });

      if (result.status) {
        await queryAccessToken({ requirePresence: false });
        const sessionState = await hydrateAuthSessionState();
        if (
          sessionState &&
          !sessionState.authSession.needsEmailVerification
        ) {
          await exchangeForSessionToken();
          navigate({
            to: resolvePostAuthDestination({
              needsOnboarding: sessionState.authSession.needsOnboarding,
              needsVerification: false,
            }),
          });
          return;
        }
        setMessage(t("auth.flow.verify_success"));
      }
    } catch (caughtError) {
      const msg = (caughtError as Error).message;
      try {
        const parsed = JSON.parse(msg);
        setError(parsed.message ?? msg);
      } catch {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  if (!auth.authenticated && !auth.needsVerification) {
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

          {!codeSent && (
            <>
              <Turnstile
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

              {turnstileError && (
                <Alert severity="error">{turnstileError}</Alert>
              )}
            </>
          )}

          <Button
            variant="contained"
            disabled={!canSend}
            onClick={handleSendCode}
            fullWidth
          >
            {codeSent
              ? cooldownRemaining > 0
                ? t("auth.flow.verify_resend_cooldown", {
                    seconds: cooldownRemaining,
                  })
                : t("auth.flow.verify_resend_code")
              : t("auth.flow.verify_send_code")}
          </Button>

          <Divider />

          {codeSent && (
            <Typography variant="body2" color="text.secondary">
              {t("auth.flow.verify_code_sent_to")}{" "}
              <strong>{email}</strong>
              {" — "}
              {t("auth.flow.verify_code_expires")}
            </Typography>
          )}

          <OtpInput
            value={otpCode}
            onChange={setOtpCode}
            disabled={loading}
          />

          <Button
            variant="contained"
            disabled={otpCode.replace(/\s/g, "").length !== 6 || loading}
            onClick={handleVerifyCode}
            fullWidth
          >
            {t("auth.flow.verify_submit_code")}
          </Button>

          {auth.loading || loading ? (
            <div className="flex items-center gap-3">
              <CircularProgress size={18} />
              <Typography variant="body2">
                {t("auth.flow.verify_checking_state")}
              </Typography>
            </div>
          ) : null}
        </>
      }
      actions={
        <Button
          variant="text"
          disabled={loading}
          onClick={handleLogout}
          color="inherit"
        >
          {t("auth.logout")}
        </Button>
      }
    />
  );
};
