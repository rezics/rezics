"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Alert, AlertDescription } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent, CardFooter, CardHeader } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { authClient } from "@/lib/auth-client";
import { getSafeAuthDestination } from "@/lib/auth-redirect";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";

function AuthPage({
	title,
	description,
	children,
	footer,
}: {
	children: ReactNode;
	description: string;
	footer: ReactNode;
	title: string;
}) {
	return (
		<main className="grid min-h-svh place-items-center bg-muted/32 p-4">
			<Card className="w-full max-w-105">
				<CardHeader description={description} title={title} />
				<CardContent>{children}</CardContent>
				<CardFooter className="justify-center text-sm">{footer}</CardFooter>
			</Card>
		</main>
	);
}

function AuthLink({ children, href }: { children: ReactNode; href: string }) {
	return (
		<Link className="text-primary underline-offset-4 hover:underline" href={href}>
			{children}
		</Link>
	);
}

function useRedirectAuthenticated(destination = "/") {
	const { data: session, isPending } = authClient.useSession();
	const router = useRouter();

	useEffect(() => {
		if (session) {
			router.replace(destination);
		}
	}, [destination, router, session]);

	return isPending || Boolean(session);
}

export function LoginPage() {
	const { t } = useTranslation({ suspense: true });
	const searchParams = useSearchParams();
	const destination = getSafeAuthDestination(searchParams.get("next"));
	const isRedirecting = useRedirectAuthenticated(destination);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>();
	const router = useRouter();

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);

		try {
			const formData = new FormData(event.currentTarget);
			const result = await authClient.signIn.email({
				email: String(formData.get("email")),
				password: String(formData.get("password")),
			});

			if (result.error) {
				setError(getErrorText(t, result.error, t.auth.loginFailed));
			} else router.replace(destination);
		} catch (error) {
			setError(getErrorText(t, error, t.auth.loginFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isRedirecting) {
		return <PendingPage />;
	}

	return (
		<AuthPage
			description={t.auth.loginDescription}
			footer={
				<>
					{t.auth.noAccount}
					<AuthLink href="/register">{t.auth.createAccount}</AuthLink>
				</>
			}
			title={t.auth.welcomeBack}
		>
			<form onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel className="sr-only">{t.auth.email}</FieldLabel>
						<Input
							autoComplete="email"
							name="email"
							placeholder="you@example.com"
							required
							size="lg"
							type="email"
						/>
					</Field>
					<Field>
						<FieldLabel className="sr-only">{t.auth.password}</FieldLabel>
						<Input
							autoComplete="current-password"
							minLength={8}
							name="password"
							placeholder={t.auth.password}
							required
							size="lg"
							type="password"
						/>
					</Field>
					<div className="text-end text-sm">
						<AuthLink href="/forgot-password">{t.auth.forgotPassword}</AuthLink>
					</div>
					<FormError error={error} />
					<Button className="w-full" isLoading={isSubmitting} size="xl" type="submit">
						{t.actions.login}
					</Button>
				</FieldGroup>
			</form>
		</AuthPage>
	);
}

export function RegisterPage() {
	const { t } = useTranslation({ suspense: true });
	const isRedirecting = useRedirectAuthenticated();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>();
	const router = useRouter();

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);

		try {
			const formData = new FormData(event.currentTarget);
			const result = await authClient.signUp.email({
				name: String(formData.get("name")),
				email: String(formData.get("email")),
				password: String(formData.get("password")),
			});

			if (result.error) {
				setError(getErrorText(t, result.error, t.auth.registerFailed));
			} else
				router.push(
					`/verify-email?email=${encodeURIComponent(String(formData.get("email")))}`,
				);
		} catch (error) {
			setError(getErrorText(t, error, t.auth.registerFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isRedirecting) {
		return <PendingPage />;
	}

	return (
		<AuthPage
			description={t.auth.registerDescription}
			footer={
				<>
					{t.auth.haveAccount}
					<AuthLink href="/login">{t.actions.login}</AuthLink>
				</>
			}
			title={t.auth.createAccountTitle}
		>
			<form onSubmit={onSubmit}>
				<FieldGroup>
					<Field>
						<FieldLabel className="sr-only">{t.auth.name}</FieldLabel>
						<Input
							autoComplete="name"
							name="name"
							placeholder={t.auth.name}
							required
							size="lg"
						/>
					</Field>
					<Field>
						<FieldLabel className="sr-only">{t.auth.email}</FieldLabel>
						<Input
							autoComplete="email"
							name="email"
							placeholder="you@example.com"
							required
							size="lg"
							type="email"
						/>
					</Field>
					<Field>
						<FieldLabel className="sr-only">{t.auth.password}</FieldLabel>
						<Input
							autoComplete="new-password"
							minLength={8}
							name="password"
							placeholder={t.auth.passwordMinimum}
							required
							size="lg"
							type="password"
						/>
					</Field>
					<FormError error={error} />
					<Button className="w-full" isLoading={isSubmitting} size="xl" type="submit">
						{t.auth.createAccount}
					</Button>
				</FieldGroup>
			</form>
		</AuthPage>
	);
}

export function ForgotPasswordPage() {
	const { t } = useTranslation({ suspense: true });
	const isRedirecting = useRedirectAuthenticated();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>();
	const [isSent, setIsSent] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);

		try {
			const formData = new FormData(event.currentTarget);
			const result = await authClient.requestPasswordReset({
				email: String(formData.get("email")),
				redirectTo: new URL("/reset-password", window.location.origin).toString(),
			});

			if (result.error) {
				setError(getErrorText(t, result.error, t.ui.retryLater));
			} else {
				setIsSent(true);
			}
		} catch (error) {
			setError(getErrorText(t, error, t.ui.retryLater));
		} finally {
			setIsSubmitting(false);
		}
	}

	if (isRedirecting) {
		return <PendingPage />;
	}

	return (
		<AuthPage
			description={t.auth.forgotDescription}
			footer={<AuthLink href="/login">{t.auth.backToLogin}</AuthLink>}
			title={t.auth.forgotPassword}
		>
			{isSent ? (
				<p className="text-muted-foreground text-sm leading-6">{t.auth.resetRequested}</p>
			) : (
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel className="sr-only">{t.auth.email}</FieldLabel>
							<Input
								autoComplete="email"
								name="email"
								placeholder="you@example.com"
								required
								size="lg"
								type="email"
							/>
						</Field>
						<FormError error={error} />
						<Button className="w-full" isLoading={isSubmitting} size="xl" type="submit">
							{t.auth.sendReset}
						</Button>
					</FieldGroup>
				</form>
			)}
		</AuthPage>
	);
}

export function ResetPasswordPage() {
	const { t } = useTranslation({ suspense: true });
	const searchParams = useSearchParams();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [error, setError] = useState<string>();
	const [isComplete, setIsComplete] = useState(false);
	const token = searchParams.get("token");

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();

		if (!token) {
			return;
		}

		const formData = new FormData(event.currentTarget);
		const newPassword = String(formData.get("password"));

		if (newPassword !== String(formData.get("confirmPassword"))) {
			setError(t.auth.passwordMismatch);
			return;
		}

		setError(undefined);
		setIsSubmitting(true);

		try {
			const result = await authClient.resetPassword({ newPassword, token });

			if (result.error) {
				setError(getErrorText(t, result.error, t.auth.resetFailed));
			} else {
				setIsComplete(true);
			}
		} catch (error) {
			setError(getErrorText(t, error, t.auth.resetFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<AuthPage
			description={t.auth.resetDescription}
			footer={<AuthLink href="/login">{t.auth.backToLogin}</AuthLink>}
			title={t.auth.resetPassword}
		>
			{isComplete ? (
				<p className="text-muted-foreground text-sm leading-6">{t.auth.resetComplete}</p>
			) : !token ? (
				<Alert variant="destructive">
					<AlertDescription>
						{searchParams.get("error") === "INVALID_TOKEN"
							? t.auth.invalidResetLink
							: t.auth.missingResetLink}
					</AlertDescription>
				</Alert>
			) : (
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<Field>
							<FieldLabel className="sr-only">{t.auth.newPassword}</FieldLabel>
							<Input
								autoComplete="new-password"
								minLength={8}
								name="password"
								placeholder={t.auth.passwordMinimum}
								required
								size="lg"
								type="password"
							/>
						</Field>
						<Field>
							<FieldLabel className="sr-only">{t.auth.confirmPassword}</FieldLabel>
							<Input
								autoComplete="new-password"
								minLength={8}
								name="confirmPassword"
								placeholder={t.auth.confirmPassword}
								required
								size="lg"
								type="password"
							/>
						</Field>
						<FormError error={error} />
						<Button className="w-full" isLoading={isSubmitting} size="xl" type="submit">
							{t.auth.updatePassword}
						</Button>
					</FieldGroup>
				</form>
			)}
		</AuthPage>
	);
}

export function VerifyEmailPage() {
	const { t } = useTranslation({ suspense: true });
	const searchParams = useSearchParams();
	const [email, setEmail] = useState(searchParams.get("email") ?? "");
	const [error, setError] = useState<string>();
	const [sent, setSent] = useState(false);
	const [pending, setPending] = useState(false);
	async function resend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setPending(true);
		try {
			const result = await authClient.sendVerificationEmail({
				email,
				callbackURL: window.location.origin,
			});
			if (result.error) setError(getErrorText(t, result.error, t.auth.verificationFailed));
			else setSent(true);
		} catch (cause) {
			setError(getErrorText(t, cause, t.auth.verificationFailed));
		} finally {
			setPending(false);
		}
	}
	return (
		<AuthPage
			title={t.auth.verifyTitle}
			description={t.auth.verifyDescription}
			footer={<AuthLink href="/login">{t.auth.backToLogin}</AuthLink>}
		>
			<form onSubmit={resend}>
				<FieldGroup>
					<Field>
						<FieldLabel className="sr-only">{t.auth.email}</FieldLabel>
						<Input
							type="email"
							required
							value={email}
							onChange={(event) => setEmail(event.currentTarget.value)}
						/>
					</Field>
					{sent && (
						<p className="text-muted-foreground text-sm">{t.auth.verificationSent}</p>
					)}
					<FormError error={error} />
					<Button type="submit" variant="outline" isLoading={pending}>
						{t.auth.resendVerification}
					</Button>
				</FieldGroup>
			</form>
		</AuthPage>
	);
}

function FormError({ error }: { error: string | undefined }) {
	return error ? (
		<Alert variant="destructive">
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	) : null;
}

function PendingPage() {
	const { t } = useTranslation({ suspense: true });
	return (
		<main className="grid min-h-svh place-items-center text-muted-foreground">
			{t.auth.restoringSession}
		</main>
	);
}
