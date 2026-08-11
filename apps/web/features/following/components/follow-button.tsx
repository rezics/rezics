"use client";

import {
	useDeleteApiUsersMeFollowingByUnitId,
	useGetApiUsersMeFollowingByUnitId,
	usePutApiUsersMeFollowingByUnitId,
	usePutApiUsersMeFollowingByUnitIdSettings,
} from "@rezics/openapi-tanstack-query";
import {
	Button,
	type ButtonProps,
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTrigger,
	Field,
	FieldContent,
	FieldDescription,
	FieldGroup,
	FieldLabel,
	Switch,
} from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";
import { Bell, BellOff, ChevronDown } from "lucide-react";
import { useId, useState } from "react";

import { invalidatePersonalizedTagQueries } from "@/features/tags/data/tag-cache";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateFollowingQueries } from "../data/following-cache";

export function FollowButton({
	unitId,
	initialFollowing,
	onChanged,
	variant = "outline",
	...buttonProps
}: {
	unitId: string;
	initialFollowing?: boolean;
	onChanged?: () => void | Promise<void>;
	variant?: ButtonProps["variant"];
} & Omit<ButtonProps, "aria-pressed" | "children" | "isLoading" | "onClick" | "variant">) {
	const { t } = useTranslation(["notifications", "ui"]);
	const { data: session } = useHydratedSession();
	const queryClient = useQueryClient();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [inAppNotificationsEnabled, setInAppNotificationsEnabled] = useState(true);
	const [realmTagSourceSubscribed, setRealmTagSourceSubscribed] = useState(false);
	const inAppInputId = useId();
	const inAppLabelId = useId();
	const inAppDescriptionId = useId();
	const realmTagInputId = useId();
	const realmTagLabelId = useId();
	const realmTagDescriptionId = useId();
	const status = useGetApiUsersMeFollowingByUnitId(
		{ path: { unitId } },
		{ query: { enabled: Boolean(session) } },
	);
	const afterMutation = async () => {
		await invalidateFollowingQueries(queryClient, unitId);
		await onChanged?.();
	};
	const follow = usePutApiUsersMeFollowingByUnitId({
		mutation: { onSuccess: afterMutation },
	});
	const unfollow = useDeleteApiUsersMeFollowingByUnitId({
		mutation: { onSuccess: afterMutation },
	});
	const replaceSettings = usePutApiUsersMeFollowingByUnitIdSettings({
		mutation: {
			onSuccess: async (updated) => {
				await invalidateFollowingQueries(queryClient, unitId);
				if (updated.kind === "realm") await invalidatePersonalizedTagQueries(queryClient);
			},
		},
	});

	if (!session) return null;

	const isFollowing = status.data?.following ?? initialFollowing ?? false;
	const statusUnavailable = status.isError;
	const mutationPending = follow.isPending || unfollow.isPending || replaceSettings.isPending;
	const followingStatus = status.data?.following ? status.data : undefined;
	const dirty = followingStatus
		? followingStatus.inAppNotificationsEnabled !== inAppNotificationsEnabled ||
			(followingStatus.kind === "realm" &&
				followingStatus.realmTagSourceSubscribed !== realmTagSourceSubscribed)
		: false;

	function changeDialogOpen(nextOpen: boolean) {
		if (mutationPending) return;
		if (nextOpen) {
			if (!followingStatus) return;
			setInAppNotificationsEnabled(followingStatus.inAppNotificationsEnabled);
			setRealmTagSourceSubscribed(
				followingStatus.kind === "realm" ? followingStatus.realmTagSourceSubscribed : false,
			);
			replaceSettings.reset();
			unfollow.reset();
		}
		setDialogOpen(nextOpen);
	}

	async function saveSettings() {
		if (!followingStatus) return;
		try {
			await replaceSettings.mutateAsync({
				path: { unitId },
				body:
					followingStatus.kind === "realm"
						? {
								kind: followingStatus.kind,
								inAppNotificationsEnabled,
								realmTagSourceSubscribed,
							}
						: {
								kind: followingStatus.kind,
								inAppNotificationsEnabled,
								realmTagSourceSubscribed: null,
							},
			});
			setDialogOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	async function stopFollowing() {
		try {
			await unfollow.mutateAsync({ path: { unitId } });
			setDialogOpen(false);
		} catch {
			// The typed mutation state supplies the visible API error.
		}
	}

	return (
		<div className="grid justify-items-end gap-2">
			{isFollowing ? (
				<Dialog onOpenChange={({ open }) => changeDialogOpen(open)} open={dialogOpen}>
					<DialogTrigger asChild>
						<Button
							{...buttonProps}
							aria-label={
								followingStatus?.inAppNotificationsEnabled === false
									? t.notifications.followingSettings.triggerDisabled
									: t.notifications.followingSettings.triggerEnabled
							}
							disabled={
								buttonProps.disabled || statusUnavailable || status.isPending || mutationPending
							}
							pill
							title={
								followingStatus?.inAppNotificationsEnabled === false
									? t.notifications.followingSettings.triggerDisabled
									: t.notifications.followingSettings.triggerEnabled
							}
							variant={variant}
						>
							{followingStatus?.inAppNotificationsEnabled === false ? (
								<BellOff aria-hidden className="size-4" />
							) : (
								<Bell aria-hidden className="size-4" />
							)}
							<ChevronDown aria-hidden className="size-3.5" />
						</Button>
					</DialogTrigger>
					<DialogContent showCloseButton={false}>
						<DialogHeader
							description={t.notifications.followingSettings.description}
							title={t.notifications.followingSettings.title}
						/>
						<DialogBody>
							<FieldGroup>
								<Field className="rounded-xl border bg-muted/24 p-4" orientation="horizontal">
									<FieldContent>
										<FieldLabel htmlFor={inAppInputId} id={inAppLabelId}>
											{t.notifications.followingSettings.inAppTitle}
										</FieldLabel>
										<FieldDescription id={inAppDescriptionId}>
											{t.notifications.followingSettings.inAppDescription}
										</FieldDescription>
									</FieldContent>
									<Switch
										aria-describedby={inAppDescriptionId}
										checked={inAppNotificationsEnabled}
										disabled={mutationPending}
										ids={{ hiddenInput: inAppInputId, label: inAppLabelId }}
										onCheckedChange={({ checked }) =>
											setInAppNotificationsEnabled(checked === true)
										}
									/>
								</Field>
								{followingStatus?.kind === "realm" ? (
									<>
										<Field className="rounded-xl border bg-muted/24 p-4" orientation="horizontal">
											<FieldContent>
												<FieldLabel htmlFor={realmTagInputId} id={realmTagLabelId}>
													{t.notifications.followingSettings.realmTagSourceTitle}
												</FieldLabel>
												<FieldDescription id={realmTagDescriptionId}>
													{t.notifications.followingSettings.realmTagSourceDescription}
												</FieldDescription>
											</FieldContent>
											<Switch
												aria-describedby={realmTagDescriptionId}
												checked={realmTagSourceSubscribed}
												disabled={mutationPending}
												ids={{
													hiddenInput: realmTagInputId,
													label: realmTagLabelId,
												}}
												onCheckedChange={({ checked }) =>
													setRealmTagSourceSubscribed(checked === true)
												}
											/>
										</Field>
										<p className="text-muted-foreground text-xs">
											{t.notifications.followingSettings.unfollowKeepsRealmTagSource}
										</p>
									</>
								) : null}
								<RequestFailure error={replaceSettings.error ?? unfollow.error} />
							</FieldGroup>
						</DialogBody>
						<DialogFooter>
							<Button
								className="sm:me-auto"
								disabled={mutationPending}
								isLoading={unfollow.isPending}
								onClick={() => void stopFollowing()}
								variant="destructive"
							>
								{t.ui.unfollow}
							</Button>
							<Button
								disabled={mutationPending}
								onClick={() => changeDialogOpen(false)}
								variant="quiet"
							>
								{t.notifications.followingSettings.cancel}
							</Button>
							<Button
								disabled={!dirty || mutationPending}
								isLoading={replaceSettings.isPending}
								onClick={() => void saveSettings()}
								variant="solid"
							>
								{t.ui.save}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>
			) : (
				<Button
					{...buttonProps}
					aria-pressed={false}
					disabled={
						buttonProps.disabled || statusUnavailable || status.isPending || mutationPending
					}
					isLoading={status.isPending || follow.isPending}
					onClick={() => follow.mutate({ path: { unitId } })}
					variant={variant}
				>
					{t.ui.follow}
				</Button>
			)}
			<RequestFailure error={status.error ?? follow.error} />
		</div>
	);
}
