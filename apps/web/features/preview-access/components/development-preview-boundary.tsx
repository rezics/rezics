"use client";

import {
	useGetApiUsersMe,
	type GetApiUsersMeStatus200PlatformCapabilitiesEnum,
} from "@rezics/openapi-tanstack-query";
import { QueryFailure, QueryPending } from "@rezics/ui";
import type { ReactNode } from "react";

import { useHydratedSession } from "@/lib/use-hydrated-session";
import { PreviewAccessNotice } from "./preview-access-notice";

const DevelopmentPreviewCapability =
	"platform.development_preview.access" satisfies GetApiUsersMeStatus200PlatformCapabilitiesEnum;

export type DevelopmentPreviewAccess =
	| { readonly state: "pending" }
	| { readonly state: "denied" }
	| { readonly state: "allowed" }
	| { readonly state: "error"; readonly error: unknown; readonly retry: () => void };

export function useDevelopmentPreviewAccess(): DevelopmentPreviewAccess {
	const session = useHydratedSession();
	const profile = useGetApiUsersMe({}, { query: { enabled: Boolean(session.data) } });

	if (session.isPending || (session.data && profile.isPending)) return { state: "pending" };
	if (!session.data) return { state: "denied" };
	if (profile.isError || !profile.data)
		return {
			state: "error",
			error: profile.error,
			retry: () => void profile.refetch(),
		};
	return profile.data.platformCapabilities.includes(DevelopmentPreviewCapability)
		? { state: "allowed" }
		: { state: "denied" };
}

export function DevelopmentPreviewBoundary({ children }: { readonly children: ReactNode }) {
	const access = useDevelopmentPreviewAccess();

	switch (access.state) {
		case "pending":
			return <QueryPending />;
		case "error":
			return <QueryFailure error={access.error} retry={access.retry} />;
		case "denied":
			return <PreviewAccessNotice />;
		case "allowed":
			return children;
	}
}
