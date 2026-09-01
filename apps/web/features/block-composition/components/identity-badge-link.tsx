"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import { Badge, IdentityAvatar } from "@rezics/ui";

import { AppLink } from "@/features/application-shell/components/app-link";

export interface IdentityBadgeLinkProps {
	readonly avatar?: PresentedAvatar | null;
	readonly href: string | null | undefined;
	readonly label: string;
}

function identityFallback(label: string): string {
	return Array.from(label.trim())[0]?.toLocaleUpperCase() ?? "#";
}

function IdentityBadgeContent({ avatar, label }: Pick<IdentityBadgeLinkProps, "avatar" | "label">) {
	return (
		<Badge
			className="h-10 max-w-full gap-2 border-border-weak bg-card px-3 text-foreground text-sm shadow-sm/5 transition-colors group-hover:bg-accent"
			pill
			variant="outline"
		>
			<IdentityAvatar
				avatar={avatar}
				className="size-6 shrink-0 text-[0.6875rem]"
				fallback={identityFallback(label)}
			/>
			<span className="min-w-0 truncate">{label}</span>
		</Badge>
	);
}

/** Compact identity navigation used by Unit List Blocks with badge presentation. */
export function IdentityBadgeLink({ avatar, href, label }: IdentityBadgeLinkProps) {
	if (!href) return <IdentityBadgeContent avatar={avatar} label={label} />;
	return (
		<AppLink
			className="group inline-flex max-w-full items-center justify-center rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/32 pointer-coarse:min-h-11 pointer-coarse:min-w-11"
			href={href}
		>
			<IdentityBadgeContent avatar={avatar} label={label} />
		</AppLink>
	);
}
