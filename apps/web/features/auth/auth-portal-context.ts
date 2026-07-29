"use client";

import { createContext, useContext } from "react";

import type { AuthPortalMode } from "@/lib/auth-redirect";

export type AuthPortalOptions = {
	destination?: string;
	email?: string;
	onClose?: () => void;
	resetError?: string | null;
	token?: string | null;
};

export type AuthPortalContextValue = {
	openAuthPortal: (mode: AuthPortalMode, options?: AuthPortalOptions) => void;
};

export const AuthPortalContext = createContext<AuthPortalContextValue | null>(null);

export function useAuthPortal() {
	const context = useOptionalAuthPortal();
	if (!context) throw new Error("useAuthPortal must be used within an AuthPortalProvider");
	return context;
}

export function useOptionalAuthPortal() {
	return useContext(AuthPortalContext);
}
