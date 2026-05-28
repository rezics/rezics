import { useTranslation } from "@rezics/i18n/react";
import { Spinner } from "@rezics/ui";
import {
  Alert,
  AlertDescription,
  Button,
  Input,
  Label,
} from "@rezics/ui/shadcn";
import { useNavigate } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useState } from "react";
import { Route } from "@/routes/login";
import { adminLogin } from "@/user/models/handler";

function normalizeRedirect(to?: string) {
  if (!to) return "/";
  if (to.startsWith("/") && !to.startsWith("//")) return to;
  return "/";
}

export default function LoginPage() {
  const { t } = useTranslation(["admin", "auth", "common"]);
  const navigate = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await adminLogin(email, password);
      navigate({
        to: normalizeRedirect(redirectTo),
        replace: true,
      });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : t("admin:user_login_failed");
      setError(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-sm py-16 px-4">
      <div className="bg-surface-elevated rounded-lg p-6">
        <h1 className="text-xl font-extrabold mb-2">
          {t("admin:user_admin_login_title")}
        </h1>
        <p className="text-sm text-text-secondary mb-4">
          {t("admin:user_admin_login_description")}
        </p>

        {error && (
          <Alert className="mb-4">
            <AlertDescription className="text-error-text">
              {error}
            </AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="grid gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="email">{t("common:email")}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="password">{t("common:password")}</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            size="lg"
            disabled={submitting}
            className="w-full"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <Spinner size="sm" />
                {t("admin:user_login_signing_in")}
              </span>
            ) : (
              t("auth:login")
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
