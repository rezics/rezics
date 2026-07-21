"use client";

import Link from "next/link";
import { forwardRef, type ComponentPropsWithoutRef } from "react";

import { useAuthPortal } from "@/features/auth/auth-portal";

type ApplicationLinkProps = ComponentPropsWithoutRef<typeof Link>;

export const AppLink = forwardRef<HTMLAnchorElement, ApplicationLinkProps>(function AppLink(
	{ href, onClick, ...props },
	ref,
) {
	const { openAuthPortal } = useAuthPortal();
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
				if (pathname !== "/login") return;
				event.preventDefault();
				openAuthPortal("login", {
					destination: href === "/login?next=/create" ? "/create" : undefined,
				});
			}}
			ref={ref}
		/>
	);
});
