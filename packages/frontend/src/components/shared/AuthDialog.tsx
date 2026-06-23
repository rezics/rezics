"use client";

import { authDialogAtom } from "@/atoms/auth-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogHeader } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { authClient } from "@/lib/auth-client";
import { useT } from "@/lib/i18n/locale";
import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

function LoginForm({ onSwitchMode }: { readonly onSwitchMode: () => void }) {
  const router = useRouter();
  const [t] = useT();
  const setDialog = useAtomSet(authDialogAtom);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof email !== "string" || typeof password !== "string") return;

    setError("");
    setLoading(true);

    const result = await authClient.signIn.email({ email, password });

    if (result.error) {
      setError(result.error.message ?? t.auth.signInFailed);
      setLoading(false);
    } else {
      setDialog({ open: false, mode: "login" });
      router.refresh();
    }
  }

  return (
    <>
      <DialogHeader description={t.auth.signInSubtitle} title={t.auth.signInTitle} />
      <DialogBody>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="auth-email">
              {t.auth.email}
            </label>
            <Input autoComplete="email" id="auth-email" name="email" required type="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="auth-password">
              {t.auth.password}
            </label>
            <Input autoComplete="current-password" id="auth-password" name="password" required type="password" />
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            {t.nav.signIn}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t.auth.noAccount}{" "}
            <button className="text-primary underline underline-offset-4" onClick={onSwitchMode} type="button">
              {t.nav.signUp}
            </button>
          </p>
        </form>
      </DialogBody>
    </>
  );
}

function RegisterForm({ onSwitchMode }: { readonly onSwitchMode: () => void }) {
  const router = useRouter();
  const [t] = useT();
  const setDialog = useAtomSet(authDialogAtom);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const name = formData.get("name");
    const email = formData.get("email");
    const password = formData.get("password");
    if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string") return;

    setError("");
    setLoading(true);

    const result = await authClient.signUp.email({ name, email, password });

    if (result.error) {
      setError(result.error.message ?? t.auth.signUpFailed);
      setLoading(false);
    } else {
      setDialog({ open: false, mode: "login" });
      router.refresh();
    }
  }

  return (
    <>
      <DialogHeader description={t.auth.signUpSubtitle} title={t.auth.signUpTitle} />
      <DialogBody>
        <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
          {error && <p className="text-destructive text-sm" role="alert">{error}</p>}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="auth-name">
              {t.auth.name}
            </label>
            <Input autoComplete="name" id="auth-name" name="name" required type="text" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="auth-email">
              {t.auth.email}
            </label>
            <Input autoComplete="email" id="auth-email" name="email" required type="email" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="auth-password">
              {t.auth.password}
            </label>
            <Input
              autoComplete="new-password"
              id="auth-password"
              minLength={8}
              name="password"
              placeholder={t.auth.passwordHint}
              required
              type="password"
            />
          </div>
          <Button className="w-full" disabled={loading} type="submit">
            {t.nav.signUp}
          </Button>
          <p className="text-muted-foreground text-center text-sm">
            {t.auth.haveAccount}{" "}
            <button className="text-primary underline underline-offset-4" onClick={onSwitchMode} type="button">
              {t.nav.signIn}
            </button>
          </p>
        </form>
      </DialogBody>
    </>
  );
}

/**
 * Mobile / Tablet / Desktop / Ultra-wide (all identical):
 * +--------------------------------------+
 * | Sign in / Create your account    [x] |
 * | subtitle                             |
 * |--------------------------------------|
 * | [error?]                             |
 * | (Name -- register only)  [input]    |
 * | Email                    [input]    |
 * | Password                 [input]    |
 * |          [Sign in / Sign up]        |
 * | Switch mode link                    |
 * +--------------------------------------+
 *
 * 宽度处置：所有控件独占一行（input/按钮均 w-full，无同行并列）；
 * 底部"切换模式"提示居中（text-center）。Dialog size sm。
 * 由 authDialogAtom 控制开关和模式切换。
 */
export function AuthDialog() {
  const { open, mode } = useAtomValue(authDialogAtom);
  const setDialog = useAtomSet(authDialogAtom);

  function handleOpenChange(details: { readonly open: boolean }) {
    setDialog({ open: details.open, mode });
  }

  function handleSwitchMode() {
    setDialog({ open: true, mode: mode === "login" ? "register" : "login" });
  }

  return (
    <Dialog onOpenChange={handleOpenChange} open={open}>
      <DialogContent showCloseButton size="sm">
        {mode === "login" ? (
          <LoginForm onSwitchMode={handleSwitchMode} />
        ) : (
          <RegisterForm onSwitchMode={handleSwitchMode} />
        )}
      </DialogContent>
    </Dialog>
  );
}
