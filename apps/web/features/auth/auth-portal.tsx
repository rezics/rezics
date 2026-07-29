"use client";

import { usePathname } from "next/navigation";
import { useQueryStates } from "nuqs";
import { toContentLanguage, type Translation } from "@rezics/i18n";
import {
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
	type FormEvent,
	type ReactNode,
} from "react";

import {
	Alert,
	AlertDescription,
	Button,
	Dialog,
	DialogBody,
	DialogContent,
	DialogHeader,
	FieldGroup,
	type ButtonProps,
} from "@rezics/ui";
import { useApplicationRouter } from "@/features/application-shell/hooks/use-application-router";
import { useTranslation } from "@/i18n/client";
import { getErrorText } from "@/i18n/errors";
import { authClient } from "@/lib/auth-client";
import { getSafeAuthDestination, type AuthPortalMode } from "@/lib/auth-redirect";
import { authSearchParamsParsers } from "@/lib/search-params";
import { AuthPortalContext, type AuthPortalOptions, useAuthPortal } from "./auth-portal-context";
import { AuthPasswordField, AuthTextField } from "./components/auth-form-field";

type AuthPortalState = {
	destination: string;
	email: string;
	id: number;
	mode: AuthPortalMode;
	onClose?: () => void;
	resetError: string | null;
	token: string | null;
};

export function SignInButton({
	destination,
	...props
}: Omit<ButtonProps, "onClick"> & {
	destination?: string;
}) {
	const { openAuthPortal } = useAuthPortal();
	return (
		<Button
			variant="brand"
			{...props}
			onClick={() => openAuthPortal("login", { destination })}
		/>
	);
}

export function AuthPortalProvider({ children }: { children: ReactNode }) {
	const pathname = usePathname();
	const router = useApplicationRouter();
	const [authQuery, setAuthQuery] = useQueryStates(authSearchParamsParsers);
	const [state, setState] = useState<AuthPortalState | null>(null);
	const handledRequest = useRef<string | undefined>(undefined);
	const queryMode = authQuery.auth;
	const queryRequest = [
		authQuery.auth,
		authQuery.next,
		authQuery.email,
		authQuery.error,
		authQuery.token,
	].join("\u0000");

	const openAuthPortal = useCallback(
		(mode: AuthPortalMode, options?: AuthPortalOptions) => {
			const currentDestination =
				typeof window === "undefined"
					? pathname
					: `${window.location.pathname}${window.location.search}${window.location.hash}`;
			setState((current) => ({
				destination: getSafeAuthDestination(options?.destination ?? currentDestination),
				email: options?.email ?? "",
				id: (current?.id ?? 0) + 1,
				mode,
				onClose: options?.onClose,
				resetError: options?.resetError ?? null,
				token: options?.token ?? null,
			}));
		},
		[pathname],
	);

	const closeAuthPortal = useCallback(() => {
		const onClose = state?.onClose;
		setState(null);

		if (queryMode) {
			void setAuthQuery(
				{ auth: null, email: null, error: null, next: null, token: null },
				{ history: "replace" },
			);
		}

		onClose?.();
	}, [queryMode, setAuthQuery, state?.onClose]);

	const setAuthPortalMode = useCallback((mode: AuthPortalMode, options?: AuthPortalOptions) => {
		setState((current) => {
			if (!current) return current;
			return {
				...current,
				...(options?.destination === undefined
					? {}
					: { destination: getSafeAuthDestination(options.destination) }),
				...(options?.email === undefined ? {} : { email: options.email }),
				...(options?.resetError === undefined ? {} : { resetError: options.resetError }),
				...(options?.token === undefined ? {} : { token: options.token }),
				id: current.id + 1,
				mode,
			};
		});
	}, []);

	const completeAuthentication = useCallback(
		(nextDestination: string) => {
			setState(null);
			void setAuthQuery(
				{ auth: null, email: null, error: null, next: null, token: null },
				{ history: "replace" },
			);
			router.replace(nextDestination);
		},
		[router, setAuthQuery],
	);
	const context = useMemo(() => ({ openAuthPortal }), [openAuthPortal]);

	useEffect(() => {
		if (!queryMode || handledRequest.current === queryRequest) return;
		handledRequest.current = queryRequest;
		openAuthPortal(queryMode, {
			destination: authQuery.next ?? "/",
			email: authQuery.email ?? undefined,
			resetError: authQuery.error,
			token: authQuery.token,
		});
	}, [authQuery, openAuthPortal, queryMode, queryRequest]);

	return (
		<AuthPortalContext.Provider value={context}>
			{children}
			<AuthPortalDialog
				onClose={closeAuthPortal}
				onComplete={completeAuthentication}
				onModeChange={setAuthPortalMode}
				state={state}
			/>
		</AuthPortalContext.Provider>
	);
}

function AuthPortalDialog({
	state,
	onClose,
	onComplete,
	onModeChange,
}: {
	onClose: () => void;
	onComplete: (destination: string) => void;
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
	state: AuthPortalState | null;
}) {
	const { t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	if (!state) return null;

	const heading = getAuthPortalHeading(state.mode, t.auth);
	return (
		<Dialog
			onOpenChange={({ open }) => {
				if (!open) onClose();
			}}
			open
		>
			<DialogContent size="sm">
				<DialogHeader description={heading.description} title={heading.title} />
				<DialogBody>
					<AuthPortalForm
						key={state.id}
						onComplete={onComplete}
						onModeChange={onModeChange}
						state={state}
					/>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}

function getAuthPortalHeading(mode: AuthPortalMode, auth: Translation["auth"]) {
	switch (mode) {
		case "login":
			return { description: auth.loginDescription, title: auth.welcomeBack };
		case "register":
			return { description: auth.registerDescription, title: auth.createAccountTitle };
		case "forgot-password":
			return { description: auth.forgotDescription, title: auth.forgotPassword };
		case "reset-password":
			return { description: auth.resetDescription, title: auth.resetPassword };
		case "verify-email":
			return { description: auth.verifyDescription, title: auth.verifyTitle };
	}
}

function AuthPortalForm({
	state,
	onComplete,
	onModeChange,
}: {
	onComplete: (destination: string) => void;
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
	state: AuthPortalState;
}) {
	switch (state.mode) {
		case "login":
			return (
				<LoginForm
					destination={state.destination}
					onComplete={onComplete}
					onModeChange={onModeChange}
				/>
			);
		case "register":
			return <RegisterForm onModeChange={onModeChange} />;
		case "forgot-password":
			return <ForgotPasswordForm onModeChange={onModeChange} />;
		case "reset-password":
			return (
				<ResetPasswordForm
					errorCode={state.resetError}
					onModeChange={onModeChange}
					token={state.token}
				/>
			);
		case "verify-email":
			return <VerifyEmailForm email={state.email} onModeChange={onModeChange} />;
	}
}

function LoginForm({
	destination,
	onComplete,
	onModeChange,
}: {
	destination: string;
	onComplete: (destination: string) => void;
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
}) {
	const { t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const passwordVisibilityLabel = (visible: boolean) =>
		visible ? t.auth.hidePassword : t.auth.showPassword;

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
			if (result.error) setError(getErrorText(t, result.error, t.auth.loginFailed));
			else onComplete(destination);
		} catch (cause) {
			setError(getErrorText(t, cause, t.auth.loginFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<>
			<form onSubmit={onSubmit}>
				<FieldGroup>
					<AuthTextField
						autoComplete="email"
						label={t.auth.email}
						name="email"
						placeholder={t.auth.emailPlaceholder}
						type="email"
					/>
					<AuthPasswordField
						autoComplete="current-password"
						label={t.auth.password}
						minLength={8}
						name="password"
						visibilityLabel={passwordVisibilityLabel}
					/>
					<div className="text-end text-sm">
						<ModeButton onClick={() => onModeChange("forgot-password")}>
							{t.auth.forgotPassword}
						</ModeButton>
					</div>
					<FormError error={error} />
					<Button
						className="w-full"
						isLoading={isSubmitting}
						size="xl"
						type="submit"
						variant="brand"
					>
						{t.actions.login}
					</Button>
				</FieldGroup>
			</form>
			<AuthModeFooter prefix={t.auth.noAccount} onClick={() => onModeChange("register")}>
				{t.auth.createAccount}
			</AuthModeFooter>
		</>
	);
}

function RegisterForm({
	onModeChange,
}: {
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
}) {
	const { locale, t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const passwordVisibilityLabel = (visible: boolean) =>
		visible ? t.auth.hidePassword : t.auth.showPassword;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);

		try {
			const formData = new FormData(event.currentTarget);
			const email = String(formData.get("email"));
			const result = await authClient.signUp.email({
				email,
				name: String(formData.get("name")),
				password: String(formData.get("password")),
				registrationContentLanguage: toContentLanguage(locale.target),
			});
			if (result.error) setError(getErrorText(t, result.error, t.auth.registerFailed));
			else onModeChange("verify-email", { email });
		} catch (cause) {
			setError(getErrorText(t, cause, t.auth.registerFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<>
			<form onSubmit={onSubmit}>
				<FieldGroup>
					<AuthTextField autoComplete="name" label={t.auth.name} name="name" />
					<AuthTextField
						autoComplete="email"
						label={t.auth.email}
						name="email"
						placeholder={t.auth.emailPlaceholder}
						type="email"
					/>
					<AuthPasswordField
						autoComplete="new-password"
						description={t.auth.passwordMinimum}
						label={t.auth.password}
						minLength={8}
						name="password"
						visibilityLabel={passwordVisibilityLabel}
					/>
					<FormError error={error} />
					<Button
						variant="solid"
						className="w-full"
						isLoading={isSubmitting}
						size="xl"
						type="submit"
					>
						{t.auth.createAccount}
					</Button>
				</FieldGroup>
			</form>
			<AuthModeFooter prefix={t.auth.haveAccount} onClick={() => onModeChange("login")}>
				{t.actions.login}
			</AuthModeFooter>
		</>
	);
}

function ForgotPasswordForm({
	onModeChange,
}: {
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
}) {
	const { t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	const [error, setError] = useState<string>();
	const [isSent, setIsSent] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);

		try {
			const formData = new FormData(event.currentTarget);
			const result = await authClient.requestPasswordReset({
				email: String(formData.get("email")),
				redirectTo: new URL("/?auth=reset-password", window.location.origin).toString(),
			});
			if (result.error) setError(getErrorText(t, result.error, t.ui.retryLater));
			else setIsSent(true);
		} catch (cause) {
			setError(getErrorText(t, cause, t.ui.retryLater));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<>
			{isSent ? (
				<p className="text-muted-foreground text-sm leading-6">{t.auth.resetRequested}</p>
			) : (
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<AuthTextField
							autoComplete="email"
							label={t.auth.email}
							name="email"
							placeholder={t.auth.emailPlaceholder}
							type="email"
						/>
						<FormError error={error} />
						<Button
							variant="solid"
							className="w-full"
							isLoading={isSubmitting}
							size="xl"
							type="submit"
						>
							{t.auth.sendReset}
						</Button>
					</FieldGroup>
				</form>
			)}
			<AuthModeFooter onClick={() => onModeChange("login")}>
				{t.auth.backToLogin}
			</AuthModeFooter>
		</>
	);
}

function ResetPasswordForm({
	errorCode,
	onModeChange,
	token,
}: {
	errorCode: string | null;
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
	token: string | null;
}) {
	const { t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	const [error, setError] = useState<string>();
	const [isComplete, setIsComplete] = useState(false);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const newPasswordVisibilityLabel = (visible: boolean) =>
		visible ? t.auth.hideNewPassword : t.auth.showNewPassword;
	const confirmPasswordVisibilityLabel = (visible: boolean) =>
		visible ? t.auth.hideConfirmPassword : t.auth.showConfirmPassword;

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!token) return;

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
			if (result.error) setError(getErrorText(t, result.error, t.auth.resetFailed));
			else setIsComplete(true);
		} catch (cause) {
			setError(getErrorText(t, cause, t.auth.resetFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<>
			{isComplete ? (
				<p className="text-muted-foreground text-sm leading-6">{t.auth.resetComplete}</p>
			) : !token ? (
				<Alert variant="destructive">
					<AlertDescription>
						{errorCode === "INVALID_TOKEN"
							? t.auth.invalidResetLink
							: t.auth.missingResetLink}
					</AlertDescription>
				</Alert>
			) : (
				<form onSubmit={onSubmit}>
					<FieldGroup>
						<AuthPasswordField
							autoComplete="new-password"
							description={t.auth.passwordMinimum}
							label={t.auth.newPassword}
							minLength={8}
							name="password"
							visibilityLabel={newPasswordVisibilityLabel}
						/>
						<AuthPasswordField
							autoComplete="new-password"
							label={t.auth.confirmPassword}
							minLength={8}
							name="confirmPassword"
							visibilityLabel={confirmPasswordVisibilityLabel}
						/>
						<FormError error={error} />
						<Button
							variant="solid"
							className="w-full"
							isLoading={isSubmitting}
							size="xl"
							type="submit"
						>
							{t.auth.updatePassword}
						</Button>
					</FieldGroup>
				</form>
			)}
			<AuthModeFooter onClick={() => onModeChange("login")}>
				{t.auth.backToLogin}
			</AuthModeFooter>
		</>
	);
}

function VerifyEmailForm({
	email: initialEmail,
	onModeChange,
}: {
	email: string;
	onModeChange: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
}) {
	const { t } = useTranslation([
		"actions",
		"auth",
		"betterAuthErrorCodes",
		"errorCodes",
		"errors",
		"ui",
	]);
	const [email, setEmail] = useState(initialEmail);
	const [error, setError] = useState<string>();
	const [isSubmitting, setIsSubmitting] = useState(false);
	const [isSent, setIsSent] = useState(false);

	async function resend(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setError(undefined);
		setIsSubmitting(true);
		try {
			const result = await authClient.sendVerificationEmail({
				email,
				callbackURL: window.location.origin,
			});
			if (result.error) setError(getErrorText(t, result.error, t.auth.verificationFailed));
			else setIsSent(true);
		} catch (cause) {
			setError(getErrorText(t, cause, t.auth.verificationFailed));
		} finally {
			setIsSubmitting(false);
		}
	}

	return (
		<>
			<form onSubmit={resend}>
				<FieldGroup>
					<AuthTextField
						autoComplete="email"
						label={t.auth.email}
						name="email"
						onChange={(event) => setEmail(event.currentTarget.value)}
						type="email"
						value={email}
					/>
					{isSent ? (
						<p className="text-muted-foreground text-sm">{t.auth.verificationSent}</p>
					) : null}
					<FormError error={error} />
					<Button
						className="w-full"
						isLoading={isSubmitting}
						type="submit"
						variant="outline"
					>
						{t.auth.resendVerification}
					</Button>
				</FieldGroup>
			</form>
			<AuthModeFooter onClick={() => onModeChange("login")}>
				{t.auth.backToLogin}
			</AuthModeFooter>
		</>
	);
}

function AuthModeFooter({
	children,
	onClick,
	prefix,
}: {
	children: ReactNode;
	onClick: () => void;
	prefix?: string;
}) {
	return (
		<div className="mt-5 flex justify-center gap-1 text-sm">
			{prefix ? <span>{prefix}</span> : null}
			<ModeButton onClick={onClick}>{children}</ModeButton>
		</div>
	);
}

function ModeButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
	return (
		<Button
			className="h-auto px-0 text-link hover:text-link-hover"
			onClick={onClick}
			size="sm"
			variant="link"
		>
			{children}
		</Button>
	);
}

function FormError({ error }: { error: string | undefined }) {
	return error ? (
		<Alert variant="destructive">
			<AlertDescription>{error}</AlertDescription>
		</Alert>
	) : null;
}
