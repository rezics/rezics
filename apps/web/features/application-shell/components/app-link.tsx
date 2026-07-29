"use client";

import Link, { useLinkStatus } from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { useOptionalAuthPortal } from "@/features/auth/auth-portal-context";
import { useNavigationProgressSignal } from "../navigation-progress-context";

type ApplicationLinkProps = ComponentPropsWithoutRef<typeof Link>;

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
				const [pathname] = href.split("?", 1);
				if (pathname !== "/login" || !authPortal) return;
				event.preventDefault();
				authPortal.openAuthPortal("login", {
					destination: href === "/login?next=/create" ? "/create" : undefined,
				});
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
