import { CheckCircle as CheckCircleIcon } from "@mui/icons-material";
import {
  CircularProgress,
  Divider,
  Step,
  StepContent,
  StepLabel,
  Stepper,
  TextField,
  Typography,
} from "@mui/material";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import { clearAllTokens } from "@rezics/api/react-query/jwt";
import { Turnstile } from "@rezics/ui/composite/auth/Turnstile.tsx";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { type FC, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/env";
import { hydrateAuthSessionState } from "@/user/state";
import { OtpInput } from "../component/OtpInput";
import { Layout } from "../layout/Layout";
import { logout } from "../model/handler";
import { useAuth } from "./useAuth";

function deriveSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Step 1: Identity Form ---

function IdentityStep({
  onComplete,
}: {
  onComplete: () => void;
}) {
  const { t } = useTranslation();
  const auth = useAuth();
  const [username, setUsername] = useState(auth.authSession?.email?.split("@")[0] ?? "");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Pre-fill from auth session (OAuth name)
  useEffect(() => {
    if (auth.user?.name && !username) {
      setUsername(auth.user.name);
    }
  }, [auth.user?.name]);

  // Auto-derive slug from username if user hasn't manually edited slug
  useEffect(() => {
    if (!slugTouched) {
      setSlug(deriveSlugFromName(username));
    }
  }, [username, slugTouched]);

  // Slug availability check
  const { data: slugCheck, isFetching: checkingSlug } = useQuery({
    ...authQueries.slugCheck(slug),
    enabled: slug.length >= 6,
  });

  const slugError = useMemo(() => {
    if (slug.length === 0) return undefined;
    if (slug.length < 6) return "Slug must be at least 6 characters";
    if (slugCheck && !slugCheck.available) {
      return slugCheck.reason === "taken"
        ? "This slug is already taken"
        : `Invalid slug: ${slugCheck.reason}`;
    }
    return undefined;
  }, [slug, slugCheck]);

  const canSubmit =
    username.trim().length > 0 &&
    slug.length >= 6 &&
    !slugError &&
    !checkingSlug &&
    !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      await authApi.confirmIdentity({ username: username.trim(), slug });
      onComplete();
    } catch (err) {
      const msg = (err as Error).message;
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

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert severity="error">{error}</Alert>}

      <TextField
        label="Username"
        variant="standard"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        required
      />

      <TextField
        label="Slug (your unique URL handle)"
        variant="standard"
        value={slug}
        onChange={(e) => {
          setSlug(e.target.value);
          setSlugTouched(true);
        }}
        error={Boolean(slugError)}
        helperText={
          checkingSlug
            ? "Checking availability..."
            : slugError ?? (slugCheck?.available ? "Available" : undefined)
        }
        required
      />

      <Button
        variant="contained"
        disabled={!canSubmit}
        onClick={handleSubmit}
        fullWidth
      >
        {loading ? t("common.loading") : "Confirm Identity"}
      </Button>
    </div>
  );
}

// --- Step 2: Email Verification ---

function EmailVerificationStep({
  email,
  onComplete,
}: {
  email: string;
  onComplete: () => void;
}) {
  const { t } = useTranslation();
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
  const cooldownRef = useRef<ReturnType<typeof setInterval>>(undefined);

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
    if (!email) return;
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
        onComplete();
        return;
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

  return (
    <div className="flex flex-col gap-4">
      {error && <Alert severity="error">{error}</Alert>}
      {message && <Alert severity="success">{message}</Alert>}

      <Typography variant="body1">
        {t("auth.flow.verify_intro_prefix")}{" "}
        <strong>{email}</strong>{" "}
        {t("auth.flow.verify_intro_suffix")}
      </Typography>

      {turnstileToken ? (
        <Alert severity="success">
          {t("auth.flow.verify_turnstile_passed")}
        </Alert>
      ) : (
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
          {turnstileError && <Alert severity="error">{turnstileError}</Alert>}
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
          {t("auth.flow.verify_code_sent_to")} <strong>{email}</strong>
          {" — "}
          {t("auth.flow.verify_code_expires")}
        </Typography>
      )}

      <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />

      <Button
        variant="contained"
        disabled={otpCode.replace(/\s/g, "").length !== 6 || loading}
        onClick={handleVerifyCode}
        fullWidth
      >
        {t("auth.flow.verify_submit_code")}
      </Button>
    </div>
  );
}

// --- Main Page ---

export const CompleteRegistrationPage: FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const auth = useAuth();
  const [justCompletedIdentity, setJustCompletedIdentity] = useState(false);
  const [justCompletedEmail, setJustCompletedEmail] = useState(false);

  const identitySet = auth.identitySet || justCompletedIdentity;
  const emailVerified =
    auth.authSession?.emailVerified || justCompletedEmail;
  const email = auth.authSession?.email ?? "";
  const trustedProvider = auth.authSession?.trustedProviderId;

  // Derive active step index for the Stepper
  const activeStep = identitySet && emailVerified ? 2 : identitySet ? 1 : 0;

  const handleIdentityComplete = useCallback(async () => {
    setJustCompletedIdentity(true);
    await hydrateAuthSessionState();
  }, []);

  const handleEmailComplete = useCallback(async () => {
    setJustCompletedEmail(true);
    clearAllTokens();
    await hydrateAuthSessionState();
  }, []);

  // Redirect once both steps complete
  useEffect(() => {
    if (identitySet && emailVerified && !auth.loading) {
      navigate({ to: "/" });
    }
  }, [identitySet, emailVerified, auth.loading, navigate]);

  // Not authenticated at all
  if (!auth.authenticated && !auth.authSession) {
    return (
      <Layout
        title="Complete Registration"
        content={
          <Alert severity="info">
            Please sign in first to complete your registration.
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

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  return (
    <Layout
      title="Complete Registration"
      content={
        <div className="flex flex-col gap-4">
          <Typography variant="body2" color="text.secondary">
            Complete the steps below to finish setting up your account.
          </Typography>

          <Stepper activeStep={activeStep} orientation="vertical">
            {/* --- Step 1: Identity --- */}
            <Step completed={identitySet}>
              <StepLabel
                optional={
                  identitySet && auth.user?.slug ? (
                    <Typography variant="caption">
                      {auth.user.slug}
                    </Typography>
                  ) : undefined
                }
              >
                Choose your identity
              </StepLabel>
              <StepContent>
                <IdentityStep onComplete={handleIdentityComplete} />
              </StepContent>
            </Step>

            {/* --- Step 2: Email Verification --- */}
            <Step completed={emailVerified}>
              <StepLabel
                optional={
                  emailVerified ? (
                    <Typography variant="caption">
                      {email}
                      {trustedProvider && ` (verified by ${trustedProvider})`}
                    </Typography>
                  ) : undefined
                }
              >
                Verify your email
              </StepLabel>
              <StepContent>
                <EmailVerificationStep
                  email={email}
                  onComplete={handleEmailComplete}
                />
              </StepContent>
            </Step>
          </Stepper>

          {activeStep === 2 && (
            <Alert
              severity="success"
              icon={<CheckCircleIcon />}
            >
              Registration complete! Redirecting...
            </Alert>
          )}
        </div>
      }
      actions={
        <Button
          variant="text"
          onClick={handleLogout}
          color="inherit"
        >
          {t("auth.logout")}
        </Button>
      }
    />
  );
};
