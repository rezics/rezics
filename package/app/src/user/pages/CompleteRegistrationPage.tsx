import { authApi } from "@rezics/api/auth/auth.api";
import { authQueries } from "@rezics/api/auth/auth.queries";
import {
  FALLBACK_LANGUAGE,
  LANGUAGE_META,
  LANGUAGES,
  type Language,
  normalizeLanguage,
} from "@rezics/contract";
import { useLocale, useTranslation } from "@rezics/i18n/react";
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
import { env } from "@/env";
import {
  hydrateAuthSessionState,
  selectRegistrationStage,
  useAuthSessionStore,
} from "@/user/states";
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

const SUPPORTED_LANGUAGES = Object.values(LANGUAGES);

function languageLabel(language: Language): string {
  return LANGUAGE_META[language]?.nativeName ?? language;
}

function uniqueLanguages(languages: readonly (string | null | undefined)[]) {
  return [
    ...new Set(
      languages
        .map((language) =>
          typeof language === "string" ? normalizeLanguage(language) : null,
        )
        .filter((language): language is Language => !!language),
    ),
  ];
}

// --- Vertical Stepper primitives (shadcn replacement for MUI Stepper) ---
// --- 垂直步进器基础组件（用 shadcn 替代 MUI Stepper） ---

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
          {/* connector line — 连接线 */}
          {!isLast && (
            <span
              className={`absolute left-[11px] top-7 bottom-0 w-px ${
                step.completed ? "bg-brand-fill" : "bg-border-whisper"
              }`}
            />
          )}
          {/* indicator — 指示器 */}
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
          {/* label + content — 标签 + 内容 */}
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

// --- Step 2: Account Setup Form ---
// --- 第 2 步：账户设置表单 ---

function IdentityStep({ onComplete }: { onComplete: () => void }) {
  const { t } = useTranslation(["auth", "common"]);
  const locale = useLocale();
  const localeLanguage = normalizeLanguage(locale) ?? FALLBACK_LANGUAGE;
  const auth = useAuth();
  const [displayName, setDisplayName] = useState(
    auth.authAccountState?.email?.split("@")[0] ?? "",
  );
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [languageTouched, setLanguageTouched] = useState(false);
  const [preferredLanguages, setPreferredLanguages] = useState<Language[]>([
    localeLanguage,
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  // Pre-fill from auth account state (OAuth name)
  // 从认证账户状态预填充（OAuth 名称）
  useEffect(() => {
    if (auth.authAccountState && !displayName) {
      setDisplayName(auth.authAccountState.email.split("@")[0] ?? "");
    }
  }, [auth.authAccountState, displayName]);

  // Auto-derive slug from username if user hasn't manually edited slug
  // 若用户尚未手动编辑 slug，则自动从用户名推导 slug
  useEffect(() => {
    if (!slugTouched) {
      setSlug(deriveSlugFromName(displayName));
    }
  }, [displayName, slugTouched]);

  useEffect(() => {
    if (!languageTouched) {
      setPreferredLanguages([localeLanguage]);
    }
  }, [languageTouched, localeLanguage]);

  const togglePreferredLanguage = useCallback((language: Language) => {
    setLanguageTouched(true);
    setPreferredLanguages((current) => {
      const next = current.includes(language)
        ? current.filter((item) => item !== language)
        : [...current, language];
      return uniqueLanguages(next);
    });
  }, []);

  // Slug availability check
  // slug 可用性检查
  const { data: slugCheck, isFetching: checkingSlug } = useQuery({
    ...authQueries.slugAvailability(slug),
    enabled: slug.length >= 6,
  });

  const slugError = useMemo(() => {
    if (slug.length === 0) return undefined;
    if (slug.length < 6) return t("auth:flow_setup_slug_short");
    if (slugCheck && !slugCheck.available) {
      return slugCheck.reason === "taken"
        ? t("auth:flow_setup_slug_taken")
        : t("auth:flow_setup_slug_invalid", { reason: slugCheck.reason ?? "" });
    }
    return undefined;
  }, [slug, slugCheck, t]);

  const canSubmit = slug.length >= 6 && !slugError && !checkingSlug && !loading;

  const handleSubmit = async () => {
    setLoading(true);
    setError(undefined);
    try {
      await authApi.setupProfile({
        ...(displayName.trim() ? { displayName: displayName.trim() } : {}),
        slug,
        preferredLanguages,
      });
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
    ? t("auth:flow_setup_slug_checking")
    : (slugError ??
      (slugCheck?.available ? t("auth:flow_setup_slug_available") : undefined));

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-username">
          {t("auth:flow_setup_display_name")}
        </Label>
        <Input
          id="reg-username"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reg-slug">{t("auth:flow_setup_slug_label")}</Label>
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

      <div className="flex flex-col gap-2">
        <Label>{t("auth:flow_setup_preferred_languages")}</Label>
        <div className="flex flex-wrap gap-2">
          {SUPPORTED_LANGUAGES.map((language) => {
            const selected = preferredLanguages.includes(language);
            return (
              <Button
                key={language}
                type="button"
                size="sm"
                variant={selected ? "default" : "outline"}
                className="h-8 px-3"
                aria-pressed={selected}
                onClick={() => togglePreferredLanguage(language)}
              >
                {languageLabel(language)}
              </Button>
            );
          })}
        </div>
      </div>

      <Button disabled={!canSubmit} onClick={handleSubmit} className="w-full">
        {loading ? t("common:loading") : t("auth:flow_setup_submit")}
      </Button>
    </div>
  );
}

// --- Step 1: Email Verification ---
// --- 第 1 步：邮箱验证 ---

function EmailVerificationStep({
  email,
  onComplete,
}: {
  email: string;
  onComplete: () => void;
}) {
  const { t } = useTranslation(["auth", "common"]);
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
          turnstileReady &&
          turnstileToken,
      ),
    [email, loading, cooldownRemaining, turnstileReady, turnstileToken],
  );

  const handleSendCode = async () => {
    if (!email) return;
    setLoading(true);
    setError(undefined);
    setMessage(undefined);
    try {
      if (!turnstileToken) {
        throw new Error(t("auth:flow_verify_complete_widget"));
      }
      await authApi.sendVerificationOTP({
        email,
        type: "email-verification",
        ...(turnstileToken && { turnstileToken }),
      });
      setMessage(t("auth:flow_verify_sent"));
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
      setError(t("auth:flow_verify_code_incomplete"));
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
        {t("auth:flow_verify_intro_prefix")} <strong>{email}</strong>{" "}
        {t("auth:flow_verify_intro_suffix")}
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
            <p className="text-sm">{t("auth:flow_verify_widget_loading")}</p>
          </div>
        }
      />
      {turnstileError && (
        <Alert variant="destructive">
          <AlertDescription>{turnstileError}</AlertDescription>
        </Alert>
      )}

      <Button
        disabled={!canSend}
        onClick={handleSendCode}
        className="w-full gap-2"
      >
        {loading && <Spinner size="sm" />}
        {loading
          ? t("auth:flow_verify_sending_code")
          : codeSent
            ? cooldownRemaining > 0
              ? t("auth:flow_verify_resend_cooldown", {
                  seconds: cooldownRemaining,
                })
              : t("auth:flow_verify_resend_code")
            : t("auth:flow_verify_send_code")}
      </Button>

      <Separator />

      {codeSent && (
        <p className="text-sm text-text-secondary">
          {t("auth:flow_verify_code_sent_to")} <strong>{email}</strong>
          {" — "}
          {t("auth:flow_verify_code_expires")}
        </p>
      )}

      <OtpInput value={otpCode} onChange={setOtpCode} disabled={loading} />

      <Button
        disabled={otpCode.replace(/\s/g, "").length !== 6 || loading}
        onClick={handleVerifyCode}
        className="w-full"
      >
        {t("auth:flow_verify_submit_code")}
      </Button>
    </div>
  );
}

// --- Main Page ---
// --- 主页面 ---

export const CompleteRegistrationPage: FC = () => {
  const { t } = useTranslation(["auth", "common"]);
  const navigate = useNavigate();
  const auth = useAuth();
  const [justCompletedEmail, setJustCompletedEmail] = useState(false);
  const [pauseConfirming, setPauseConfirming] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [pauseError, setPauseError] = useState<string>();
  const [materializing, setMaterializing] = useState(false);
  const [materializeError, setMaterializeError] = useState<string>();
  const authSessionStatus = useAuthSessionStore((state) => state.status);
  const registrationStage = useAuthSessionStore(selectRegistrationStage);
  const [sessionProbeStatus, setSessionProbeStatus] = useState<
    "idle" | "loading" | "done"
  >("idle");

  const effectiveRegistrationStage =
    justCompletedEmail && registrationStage === "verify-email"
      ? "setup-account"
      : registrationStage;
  const emailVerified =
    effectiveRegistrationStage !== "verify-email" &&
    (auth.authAccountState?.emailVerified || justCompletedEmail);
  const mainUserExists = auth.mainUserExists;
  const email = auth.authAccountState?.email ?? "";
  const trustedProvider = auth.authAccountState?.trustedProviderId;
  const checkingAuthSession =
    !auth.authAccountState &&
    (auth.loading ||
      authSessionStatus === "idle" ||
      sessionProbeStatus !== "done");

  // Derive active step index for the Stepper
  // 为步进器推导当前激活的步骤索引
  const activeStep =
    effectiveRegistrationStage === "verify-email"
      ? 0
      : effectiveRegistrationStage === "complete"
        ? 2
        : 1;

  const handleAccountSetupComplete = useCallback(async () => {
    await hydrateAuthSessionState({ requirePresence: false });
    navigate({ to: "/" });
  }, [navigate]);

  const handleEmailComplete = useCallback(async () => {
    setJustCompletedEmail(true);
    setMaterializing(true);
    setMaterializeError(undefined);
    try {
      await authApi.materializeAccount();
    } catch (caughtError) {
      const msg = (caughtError as Error).message;
      try {
        const parsed = JSON.parse(msg);
        setMaterializeError(parsed.message ?? msg);
      } catch {
        setMaterializeError(msg);
      }
    } finally {
      setMaterializing(false);
    }
    await hydrateAuthSessionState({ requirePresence: false });
  }, []);

  useEffect(() => {
    if (
      !emailVerified ||
      mainUserExists ||
      materializing ||
      materializeError ||
      effectiveRegistrationStage !== "setup-account"
    ) {
      return;
    }

    let mounted = true;
    setMaterializing(true);
    void authApi
      .materializeAccount()
      .catch((caughtError) => {
        const msg = (caughtError as Error).message;
        try {
          const parsed = JSON.parse(msg);
          if (mounted) setMaterializeError(parsed.message ?? msg);
        } catch {
          if (mounted) setMaterializeError(msg);
        }
      })
      .then(() => hydrateAuthSessionState({ requirePresence: false }))
      .finally(() => {
        if (mounted) setMaterializing(false);
      });

    return () => {
      mounted = false;
    };
  }, [
    effectiveRegistrationStage,
    emailVerified,
    mainUserExists,
    materializeError,
    materializing,
  ]);

  useEffect(() => {
    if (
      auth.authAccountState ||
      authSessionStatus === "loading" ||
      sessionProbeStatus !== "idle"
    ) {
      return;
    }

    let mounted = true;
    setSessionProbeStatus("loading");
    void hydrateAuthSessionState({ requirePresence: false }).finally(() => {
      if (mounted) {
        setSessionProbeStatus("done");
      }
    });

    return () => {
      mounted = false;
    };
  }, [auth.authAccountState, authSessionStatus, sessionProbeStatus]);

  // Redirect once both steps complete
  // 两个步骤都完成后重定向
  useEffect(() => {
    if (auth.registrationComplete && !auth.loading) {
      navigate({ to: "/" });
    }
  }, [auth.registrationComplete, auth.loading, navigate]);

  const handleLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  const handlePauseRegistration = async () => {
    if (!pauseConfirming) {
      setPauseConfirming(true);
      return;
    }

    setPausing(true);
    setPauseError(undefined);
    try {
      await logout(true);
      navigate({ to: "/login" });
    } catch (caughtError) {
      setPauseError((caughtError as Error).message);
    } finally {
      setPausing(false);
    }
  };

  const pauseRegistrationButton = (
    <Button
      variant="ghost"
      disabled={pausing}
      onClick={handlePauseRegistration}
    >
      {pausing
        ? t("common:loading")
        : pauseConfirming
          ? t("auth:flow_pause_registration_confirm")
          : t("auth:flow_pause_registration")}
    </Button>
  );

  if (checkingAuthSession && !auth.authAccountState) {
    return (
      <Layout
        title={t("auth:flow_complete_registration_title")}
        content={
          <div className="flex items-center gap-3 text-sm text-text-secondary">
            <Spinner size="sm" />
            <span>{t("auth:flow_verify_checking_state")}</span>
          </div>
        }
        actions={pauseRegistrationButton}
      />
    );
  }

  // Not authenticated at all
  // 完全未认证
  if (!auth.authenticated && !auth.authAccountState) {
    return (
      <Layout
        title={t("auth:flow_complete_registration_title")}
        content={
          <div className="flex flex-col gap-4">
            <Alert>
              <AlertDescription>
                {t("auth:flow_onboarding_sign_in_first")}
              </AlertDescription>
            </Alert>
            {pauseError && (
              <Alert variant="destructive">
                <AlertDescription>{pauseError}</AlertDescription>
              </Alert>
            )}
          </div>
        }
        actions={
          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={() => navigate({ to: "/login" })}>
              {t("auth:login")}
            </Button>
          </div>
        }
      />
    );
  }

  const steps: StepDefinition[] = [
    {
      id: "email",
      label: t("auth:flow_verify_title"),
      optional: emailVerified
        ? `${email}${trustedProvider ? ` (verified by ${trustedProvider})` : ""}`
        : undefined,
      completed: !!emailVerified,
      active: activeStep === 0,
      content: (
        <EmailVerificationStep email={email} onComplete={handleEmailComplete} />
      ),
    },
    {
      id: "account",
      label: t("auth:flow_setup_title"),
      optional: mainUserExists && auth.user?.slug ? auth.user.slug : undefined,
      completed: effectiveRegistrationStage === "complete",
      active: activeStep === 1 && !materializing,
      content: <IdentityStep onComplete={handleAccountSetupComplete} />,
    },
  ];

  return (
    <Layout
      title={t("auth:flow_complete_registration_title")}
      content={
        <div className="flex flex-col gap-4">
          <p className="text-sm text-text-secondary">
            {t("auth:flow_complete_registration_intro")}
          </p>

          <VerticalStepper steps={steps} />

          {materializing && (
            <div className="flex items-center gap-3 text-sm text-text-secondary">
              <Spinner size="sm" />
              <span>{t("auth:flow_verify_checking_state")}</span>
            </div>
          )}

          {materializeError && (
            <Alert variant="destructive">
              <AlertDescription>{materializeError}</AlertDescription>
            </Alert>
          )}

          {pauseError && (
            <Alert variant="destructive">
              <AlertDescription>{pauseError}</AlertDescription>
            </Alert>
          )}

          {activeStep === 2 && (
            <Alert className="text-success-text">
              <CheckCircleIcon className="w-4 h-4" />
              <AlertDescription>
                {t("auth:flow_registration_complete_redirecting")}
              </AlertDescription>
            </Alert>
          )}
        </div>
      }
      actions={
        mainUserExists ? (
          <Button variant="ghost" onClick={handleLogout}>
            {t("auth:logout")}
          </Button>
        ) : (
          pauseRegistrationButton
        )
      }
    />
  );
};
