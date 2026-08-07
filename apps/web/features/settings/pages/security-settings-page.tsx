"use client";

import {
	Button,
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
	Checkbox,
	Field,
	FieldGroup,
	FieldLabel,
	ManagementWorkspaceSectionHeader,
} from "@rezics/ui";
import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useEffect, useState, type FocusEventHandler, type FormEvent } from "react";

import { AuthPasswordField } from "@/features/auth/components/auth-form-field";
import { passwordConfirmationMatches } from "@/features/auth/model/password-confirmation";
import { useTranslation } from "@/i18n/client";
import { authClient } from "@/lib/auth-client";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { SettingsOverviewHref } from "../routing/settings-routes";

type ListSessionsResult = Awaited<ReturnType<typeof authClient.listSessions>>;
type AccountSession = NonNullable<ListSessionsResult["data"]>[number];
type SessionListState =
	| { status: "pending" }
	| { status: "error" }
	| { status: "ready"; sessions: readonly AccountSession[] };

function formatDate(value: Date | string, locale: string) {
	const date = value instanceof Date ? value : new Date(value);
	return new Intl.DateTimeFormat(locale, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

export function SecuritySettingsPage() {
	const { t, locale } = useTranslation(["auth", "settings", "ui"]);
	const currentSession = useHydratedSession();
	const [sessionList, setSessionList] = useState<SessionListState>({ status: "pending" });
	const [passwordState, setPasswordState] = useState<
		"idle" | "pending" | "saved" | "error" | "mismatch"
	>("idle");
	const [revokingToken, setRevokingToken] = useState<string>();
	const [sessionActionFailed, setSessionActionFailed] = useState(false);
	const handleConfirmPasswordBlur: FocusEventHandler<HTMLInputElement> = (event) => {
		const form = event.currentTarget.form;
		if (!form) return;
		const formData = new FormData(form);
		const newPassword = String(formData.get("newPassword") ?? "");
		const confirmPassword = String(formData.get("confirmPassword") ?? "");
		const isMismatch =
			confirmPassword.length > 0 &&
			!passwordConfirmationMatches(newPassword, confirmPassword);
		if (isMismatch) setPasswordState("mismatch");
		else if (passwordState === "mismatch") setPasswordState("idle");
	};

	useEffect(() => {
		let active = true;
		void authClient
			.listSessions()
			.then((result) => {
				if (!active) return;
				setSessionList(
					result.data ? { status: "ready", sessions: result.data } : { status: "error" },
				);
			})
			.catch(() => {
				if (active) setSessionList({ status: "error" });
			});
		return () => {
			active = false;
		};
	}, []);

	async function changePassword(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const element = event.currentTarget;
		const form = new FormData(element);
		const currentPassword = String(form.get("currentPassword") ?? "");
		const newPassword = String(form.get("newPassword") ?? "");
		const confirmPassword = String(form.get("confirmPassword") ?? "");
		if (!passwordConfirmationMatches(newPassword, confirmPassword)) {
			setPasswordState("mismatch");
			return;
		}

		setPasswordState("pending");
		try {
			const result = await authClient.changePassword({
				currentPassword,
				newPassword,
				revokeOtherSessions: form.get("revokeOtherSessions") === "on",
			});
			if (result.error) {
				setPasswordState("error");
				return;
			}
			element.reset();
			setPasswordState("saved");
		} catch {
			setPasswordState("error");
		}
	}

	async function revokeSession(token: string) {
		setSessionActionFailed(false);
		setRevokingToken(token);
		try {
			const result = await authClient.revokeSession({ token });
			if (result.error) setSessionActionFailed(true);
			else {
				setSessionList((current) =>
					current.status === "ready"
						? {
								status: "ready",
								sessions: current.sessions.filter(
									(session) => session.token !== token,
								),
							}
						: current,
				);
			}
		} catch {
			setSessionActionFailed(true);
		} finally {
			setRevokingToken(undefined);
		}
	}

	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				description={t.settings.securityDescription}
				link={Link}
				title={t.settings.security}
			/>
			<div className="grid gap-6">
				<Card appearance="outlined">
					<CardContent className="p-6">
						<form onSubmit={changePassword}>
							<FieldGroup>
								<AuthPasswordField
									autoComplete="current-password"
									label={t.settings.currentPassword}
									name="currentPassword"
									visibilityLabel={(visible) =>
										visible ? t.auth.hidePassword : t.auth.showPassword
									}
								/>
								<AuthPasswordField
									autoComplete="new-password"
									description={t.auth.passwordMinimum}
									label={t.settings.newPassword}
									minLength={8}
									name="newPassword"
									visibilityLabel={(visible) =>
										visible ? t.auth.hideNewPassword : t.auth.showNewPassword
									}
								/>
								<AuthPasswordField
									autoComplete="new-password"
									error={
										passwordState === "mismatch"
											? t.auth.passwordMismatch
											: undefined
									}
									label={t.auth.confirmPassword}
									minLength={8}
									name="confirmPassword"
									onBlur={handleConfirmPasswordBlur}
									visibilityLabel={(visible) =>
										visible
											? t.auth.hideConfirmPassword
											: t.auth.showConfirmPassword
									}
								/>
								<Field orientation="horizontal">
									<Checkbox defaultChecked name="revokeOtherSessions" />
									<FieldLabel>{t.settings.revokeOtherSessions}</FieldLabel>
								</Field>
								{passwordState === "saved" ? (
									<p className="text-success text-sm">
										{t.settings.passwordChanged}
									</p>
								) : null}
								{passwordState === "error" ? (
									<p className="text-destructive text-sm">{t.ui.retryLater}</p>
								) : null}
								<Button
									isLoading={passwordState === "pending"}
									type="submit"
									variant="solid"
								>
									{t.ui.save}
								</Button>
							</FieldGroup>
						</form>
					</CardContent>
				</Card>
				<Card appearance="outlined">
					<CardHeader>
						<CardTitle>{t.settings.sessions}</CardTitle>
						<CardDescription>{t.settings.sessionsDescription}</CardDescription>
					</CardHeader>
					<CardContent className="grid gap-3">
						{sessionActionFailed ? (
							<p className="text-sm text-destructive">{t.ui.retryLater}</p>
						) : null}
						{sessionList.status === "pending" ? (
							<p className="text-sm text-muted-foreground">{t.ui.loading}</p>
						) : null}
						{sessionList.status === "error" ? (
							<p className="text-sm text-destructive">{t.ui.retryLater}</p>
						) : null}
						{sessionList.status === "ready"
							? sessionList.sessions.map((session) => {
									const isCurrent =
										session.token === currentSession.data?.session.token;
									return (
										<div
											className="flex flex-wrap items-start justify-between gap-4 rounded-lg border border-border-weak p-4"
											key={session.id}
										>
											<div className="min-w-0 text-sm">
												<p className="break-words font-medium">
													{session.userAgent || t.settings.unknownDevice}
													{isCurrent
														? ` · ${t.settings.currentSession}`
														: ""}
												</p>
												<p className="mt-1 text-muted-foreground">
													{session.ipAddress || t.settings.unknownAddress}
												</p>
												<p className="mt-1 text-xs text-muted-foreground">
													{t.settings.lastUpdated}:{" "}
													{formatDate(session.updatedAt, locale.current)}{" "}
													· {t.settings.sessionExpires}:{" "}
													{formatDate(session.expiresAt, locale.current)}
												</p>
											</div>
											{!isCurrent ? (
												<Button
													isLoading={revokingToken === session.token}
													onClick={() =>
														void revokeSession(session.token)
													}
													size="sm"
													type="button"
													variant="outline"
												>
													{t.settings.revokeSession}
												</Button>
											) : null}
										</div>
									);
								})
							: null}
					</CardContent>
				</Card>
			</div>
		</section>
	);
}
