"use client";
import { useResolveMainIdentityPreference } from "@rezics/openapi-tanstack-query";
import { useMemo } from "react";
import { createMembershipClient } from "@/features/participation/data/participation-client";
/** Capture the chosen public Entity context; absent control never falls back to private enrollment. */
export function useRealmMembershipContext() {
	const context = useResolveMainIdentityPreference();
	const selection = context.data?.status === "ready" ? context.data.selection : undefined;
	const client = useMemo(
		() => (selection ? createMembershipClient({ selection }) : undefined),
		[selection],
	);
	return {
		selectionKey: JSON.stringify(selection ?? null),
		client,
		ready: client !== undefined,
		pending: context.isPending,
		error: context.error,
	};
}
