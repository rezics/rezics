"use client";

import {
	useGetApiUsersMe,
	type GetApiUsersMeStatus200PlatformCapabilitiesEnum,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import type { ReactNode } from "react";

import { useHydratedSession } from "@/lib/use-hydrated-session";
import { PreviewAccessNotice } from "./preview-access-notice";

export type PreviewCapability = Extract<
	GetApiUsersMeStatus200PlatformCapabilitiesEnum,
	`unit.${string}.preview`
>;

export function PreviewCapabilityBoundary({
	capability,
	children,
}: {
	readonly capability: PreviewCapability;
	readonly children: ReactNode;
}) {
	const session = useHydratedSession();
	const profile = useGetApiUsersMe({ query: { enabled: Boolean(session.data) } });

	if (session.isPending || (session.data && profile.isPending)) return <QueryPending />;
	if (!session.data) return <PreviewAccessNotice />;
	if (profile.isError || !profile.data)
		return <QueryFailure error={profile.error} retry={() => void profile.refetch()} />;
	if (!profile.data.platformCapabilities.includes(capability)) return <PreviewAccessNotice />;
	return children;
}
