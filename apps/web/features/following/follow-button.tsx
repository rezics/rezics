"use client";

import {
	useDeleteApiUsersMeFollowingByUnitId,
	useGetApiUsersMeFollowingByUnitId,
	usePutApiUsersMeFollowingByUnitId,
} from "@rezics/openapi-tanstack-query";
import { Button, type ButtonProps } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateFollowingQueries } from "./following-cache";

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
	const { t } = useTranslation(["ui"]);
	const { data: session } = useHydratedSession();
	const queryClient = useQueryClient();
	const status = useGetApiUsersMeFollowingByUnitId(
		{ path: { unitId } },
		{ query: { enabled: Boolean(session) && initialFollowing === undefined } },
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

	if (!session) return null;

	const isFollowing = status.data?.following ?? initialFollowing ?? false;
	const statusUnavailable = initialFollowing === undefined && status.isError;
	return (
		<div className="grid justify-items-end gap-2">
			<Button
				{...buttonProps}
				aria-pressed={isFollowing}
				disabled={buttonProps.disabled || statusUnavailable}
				isLoading={
					(initialFollowing === undefined && status.isPending) ||
					follow.isPending ||
					unfollow.isPending
				}
				onClick={() => {
					const mutation = isFollowing ? unfollow : follow;
					mutation.mutate({ path: { unitId } });
				}}
				variant={variant}
			>
				{isFollowing ? t.ui.unfollow : t.ui.follow}
			</Button>
			<RequestFailure error={status.error ?? follow.error ?? unfollow.error} />
		</div>
	);
}
