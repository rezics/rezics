"use client";

import { HoverCard, HoverCardContent, HoverCardTrigger, IdentityAvatar } from "@rezics/ui";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";
import { RealmInfoCard } from "@/features/realms/components/realm-info-card";
import { realmHref } from "@/features/slugs/unit-route";
import type { RealmTagGroupPresentation } from "../model/tag-presentation";

type RealmTagContextIdentity = Pick<
	RealmTagGroupPresentation,
	"avatar" | "language" | "realmId" | "summary" | "title"
>;

export function RealmTagContextHeading({
	fallbackTitle,
	realm,
}: {
	readonly fallbackTitle: string;
	readonly realm: RealmTagContextIdentity;
}) {
	const sourceTitle = realm.title ?? fallbackTitle;
	const title = useChineseContentText(sourceTitle, realm.title ? realm.language : undefined);
	const initials = Array.from(title.trim())[0]?.toLocaleUpperCase() ?? title;

	return (
		<HoverCard closeDelay={160} openDelay={320} positioning={{ placement: "bottom-start" }}>
			<HoverCardTrigger asChild>
				<Link
					className="inline-flex max-w-full min-w-0 items-center gap-2 rounded-md outline-none underline-offset-4 hover:underline focus-visible:ring-[3px] focus-visible:ring-ring/32"
					href={realmHref({ id: realm.realmId })}
				>
					<IdentityAvatar avatar={realm.avatar} fallback={initials} size="sm" />
					<span className="truncate">{title}</span>
				</Link>
			</HoverCardTrigger>
			<HoverCardContent className="w-72">
				<RealmInfoCard
					realm={{
						id: realm.realmId,
						name: sourceTitle,
						initials,
						language: realm.title ? realm.language : undefined,
						avatar: realm.avatar,
						summary: realm.summary ?? undefined,
					}}
				/>
			</HoverCardContent>
		</HoverCard>
	);
}
