"use client";

import { fontAwesomeIconClassNames, type PresentedAvatar } from "@rezics/avatar";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "../utils";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";

export interface IdentityAvatarProps extends Omit<ComponentProps<typeof Avatar>, "children"> {
	readonly avatar?: PresentedAvatar | null;
	readonly fallback: ReactNode;
	readonly imageAlt?: string;
}

/** Render image, Unicode emoji, and CDN-backed icon avatars as first-class variants. */
export function IdentityAvatar({
	avatar,
	fallback,
	imageAlt = "",
	className,
	...props
}: IdentityAvatarProps) {
	return (
		<Avatar className={cn("[container-type:inline-size]", className)} {...props}>
			{avatar?.type === "image" ? (
				<>
					<AvatarImage alt={imageAlt} src={avatar.image.url} />
					<AvatarFallback>{fallback}</AvatarFallback>
				</>
			) : avatar?.type === "emoji" ? (
				<span
					aria-hidden
					className="flex size-full items-center justify-center rounded-[inherit] bg-muted text-[58cqi] leading-none"
					data-slot="avatar-emoji"
				>
					{avatar.emoji}
				</span>
			) : avatar?.type === "icon" ? (
				<span
					aria-hidden
					className="flex size-full items-center justify-center rounded-[inherit] bg-muted text-[52cqi] leading-none"
					data-slot="avatar-icon"
				>
					<i className={fontAwesomeIconClassNames(avatar.icon).join(" ")} />
				</span>
			) : (
				<AvatarFallback>{fallback}</AvatarFallback>
			)}
		</Avatar>
	);
}
