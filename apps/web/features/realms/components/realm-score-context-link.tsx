"use client";

import { useGetApiRealmsByRealmIdScoreContext } from "@rezics/openapi-tanstack-query";
import { cn } from "@rezics/ui";
import { BookOpenText } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { postHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";

export function RealmScoreContextLink({
	className,
	realmId,
}: {
	readonly className?: string;
	readonly realmId: string;
}) {
	const query = useGetApiRealmsByRealmIdScoreContext({ path: { realmId } });
	const contextPostId = query.data?.contextPostId;
	if (!contextPostId) return null;
	return (
		<RealmScoreContextPostLink
			className={className}
			contextPostId={contextPostId}
			realmId={realmId}
		/>
	);
}

export function RealmScoreContextPostLink({
	className,
	contextPostId,
	realmId,
}: {
	readonly className?: string;
	readonly contextPostId: string;
	readonly realmId: string;
}) {
	const { t } = useTranslation(["engagement"]);
	return (
		<Link
			className={cn(
				"inline-flex w-fit items-center gap-1.5 rounded-sm text-sm font-medium text-link outline-none hover:text-link-hover hover:underline focus-visible:ring-2 focus-visible:ring-ring",
				className,
			)}
			href={postHref(contextPostId, { kind: "realm", realmId })}
		>
			<BookOpenText aria-hidden className="size-4" />
			{t.engagement.scoreGuidelines}
		</Link>
	);
}
