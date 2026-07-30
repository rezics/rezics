"use client";

import Link, { useLinkStatus } from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { useOptionalAuthPortal } from "@/features/auth/auth-portal-context";
import type { AuthPortalMode } from "@/lib/auth-redirect";
import { useNavigationProgressSignal } from "../navigation-progress-context";

type ApplicationLinkProps = ComponentPropsWithoutRef<typeof Link>;

function getAuthPortalMode(pathname: string): AuthPortalMode | undefined {
	if (pathname === "/login") return "login";
	if (pathname === "/register") return "register";
	return undefined;
}

export const AppLink = forwardRef<HTMLAnchorElement, ApplicationLinkProps>(function AppLink(
	{ children, href, onClick, ...props },
	ref,
) {
	const authPortal = useOptionalAuthPortal();
	return (
		<Link
			{...props}
			href={href}
			onClick={(event) => {
				onClick?.(event);
				if (
					event.defaultPrevented ||
					event.button !== 0 ||
					event.metaKey ||
					event.ctrlKey ||
					event.shiftKey ||
					event.altKey ||
					(event.currentTarget.target && event.currentTarget.target !== "_self") ||
					typeof href !== "string"
				)
					return;
				const pathAndQuery = href.split("#", 1)[0] ?? "";
				const [pathname = "", query = ""] = pathAndQuery.split("?", 2);
				const mode = getAuthPortalMode(pathname);
				if (!mode || !authPortal) return;
				event.preventDefault();
				const destination = new URLSearchParams(query).get("next") ?? undefined;
				authPortal.openAuthPortal(mode, destination ? { destination } : undefined);
			}}
			ref={ref}
		>
			{children}
			<LinkProgressSignal />
		</Link>
	);
});

function LinkProgressSignal() {
	const { pending } = useLinkStatus();
	useNavigationProgressSignal(pending);
	return null;
}
