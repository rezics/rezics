import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import {
  exchangeForSessionToken,
  queryAccessToken,
} from "@rezics/api/react-query/jwt";
import { Spinner } from "@rezics/ui";
import { Turnstile } from "@rezics/ui/composite/auth/Turnstile.tsx";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
  Separator,
} from "@rezics/ui/shadcn";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import {
  CircleCheck as CheckCircleIcon,
  Check as CheckIcon,
} from "lucide-react";
import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { env } from "@/env";
import { hydrateAuthSessionState } from "@/user/states";
import { OtpInput } from "../components/OtpInput";
import { Layout } from "../layouts/Layout";
import { logout } from "../models/handler";
import { useAuth } from "./useAuth";

function deriveSlugFromName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/--+/g, "-")
    .replace(/^-|-$/g, "");
}

// --- Vertical Stepper primitives (shadcn replacement for MUI Stepper) ---

type StepDefinition = {
  id: string;
  label: ReactNode;
  optional?: ReactNode;
  completed: boolean;
  active: boolean;
  content: ReactNode;
};

const VerticalStepper: FC<{ steps: StepDefinition[] }> = ({ steps }) => (
  <ol className="flex flex-col">
    {steps.map((step, idx) => {
      const isLast = idx === steps.length - 1;
      return (
        <li key={step.id} className="relative flex gap-3">
          {/* connector line */}
          {!isLast && (
            <span
              className={`absolute left-[11px] top-7 bottom-0 w-px ${
                step.completed ? "bg-brand-fill" : "bg-border-whisper"
              }`}
            />
          )}
          {/* indicator */}
          <span
            className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
              step.completed
                ? "bg-brand-fill text-white"
                : step.active
                  ? "bg-brand-fill text-white"
                  : "bg-border-whisper text-text-secondary"
            }`}
          >
            {step.completed ? <CheckIcon className="w-3.5 h-3.5" /> : idx + 1}
          </span>
          {/* label + content */}
          <div className="flex-1 pb-6 min-w-0">
            <div className="flex flex-col">
              <span
                className={`text-sm font-medium ${
                  step.active || step.completed
                    ? "text-text-primary"
                    : "text-text-secondary"
                }`}
              >
                {step.label}
              </span>
              {step.optional && (
                <span className="text-xs text-text-secondary">
                  {step.optional}
                </span>
              )}
            </div>
            {step.active && <div className="mt-3">{step.content}</div>}
          </div>
        </li>
      );
    })}
  </ol>
);

// --- Step 1: Identity Form ---

function IdentityStep({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation();
  const auth = useAuth();
  const [username, setUsername] = useState(
    auth.authSession?.email?.split("@")[0] ?? "",
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Pre-fill from auth session (OAuth name)
  useEffect(() => {
    if (auth.user?.name && !username) {
      setUsername(auth.user.name);
    }
  }, [auth.user?.name, username]);

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

  const slugHelper = checkingSlug
    ? "Checking availability..."
    : (slugError ?? (slugCheck?.available ? "Available" : undefined));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-username">Username</Label>
        <Input
          id="reg-username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-slug">Slug (your unique URL handle)</Label>
        <Input
          id="reg-slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugTouched(true);
          }}
          required
          className={slugError ? "border-border-error" : ""}
        />
        {slugHelper && (
          <p
            className={`text-xs ${
              slugError ? "text-error-text" : "text-text-secondary"
            }`}
          >
            {slugHelper}
          </p>
        )}
      </div>

      <Button disabled={!canSubmit} onClick={handleSubmit} className="w-full">
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
    [
      email,
      loading,
      cooldownRemaining,
      codeSent,
      turnstileReady,
      turnstileToken,
    ],
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
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert className="text-success-text">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}

      <p className="text-base">
        {t("auth.flow.verify_intro_prefix")} <strong>{email}</strong>{" "}
        {t("auth.flow.verify_intro_suffix")}
      </p>

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
        onExpired={() => {
          setTurnstileToken(undefined);
        }}
        loadingComponent={
          <div className="flex items-center gap-3">
            <Spinner size="sm" />
            <p className="text-sm">{t("auth.flow.verify_widget_loading")}</p>
          </div>
        }
      />
      {turnstileError && (
        <Alert variant="destructive">
          <AlertDescription>{turnstileError}</AlertDescription>
        </Alert>
      )}

      <Button disabled={!canSend} onClick={handleSendCode} className="w-full">
        {codeSent
          ? cooldownRemaining > 0
            ? t("auth.flow.verify_resend_cooldown", {
                seconds: cooldownRemaining,
              })
            : t("auth.flow.verify_resend_code")
          : t("auth.flow.verify_send_code")}
      </Button>

      <Separator />

      {codeSent && (
        <p className="text-sm text-text-secondary">
          {t("auth.flow.verify_code_sent_to")} <strong>{email}</strong>
          {" — "}
          {t("auth.flow.verify_code_expires")}
        </p>
      )}

      <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />

      <Button
        disabled={otpCode.replace(/\s/g, "").length !== 6 || loading}
        onClick={handleVerifyCode}
        className="w-full"
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
  const emailVerified = auth.authSession?.emailVerified || justCompletedEmail;
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
    // Re-acquire fresh tokens (claims now include email_verified: true)
    // instead of clearing — clearing creates a gap where the user appears logged out.
    await queryAccessToken({ requirePresence: false });
    await exchangeForSessionToken();
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
          <Alert>
            <AlertDescription>
              Please sign in first to complete your registration.
            </AlertDescription>
          </Alert>
        }
        actions={
          <Button onClick={() => navigate({ to: "/login" })}>
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

  const steps: StepDefinition[] = [
    {
      id: "identity",
      label: "Choose your identity",
      optional: identitySet && auth.user?.slug ? auth.user.slug : undefined,
      completed: identitySet,
      active: activeStep === 0,
      content: <IdentityStep onComplete={handleIdentityComplete} />,
    },
    {
      id: "email",
      label: "Verify your email",
      optional: emailVerified
        ? `${email}${trustedProvider ? ` (verified by ${trustedProvider})` : ""}`
        : undefined,
      completed: !!emailVerified,
      active: activeStep === 1,
      content: (
        <EmailVerificationStep email={email} onComplete={handleEmailComplete} />
      ),
    },
  ];

  return (
    <Layout
      title="Complete Registration"
      content={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            Complete the steps below to finish setting up your account.
          </p>

          <VerticalStepper steps={steps} />

          {activeStep === 2 && (
            <Alert className="text-success-text">
              <CheckCircleIcon className="w-4 h-4" />
              <AlertDescription>
                Registration complete! Redirecting...
              </AlertDescription>
            </Alert>
          )}
        </div>
      }
      actions={
        <Button variant="ghost" onClick={handleLogout}>
          {t("auth.logout")}
        </Button>
      }
    />
  );
};
