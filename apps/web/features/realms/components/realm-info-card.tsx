"use client";

import type { PresentedAvatar } from "@rezics/avatar";
import type { ContentLanguage } from "@rezics/i18n";
import { IdentityAvatar } from "@rezics/ui";

import { useChineseContentText } from "@/features/content-language-display/chinese-content-display-context";

export interface RealmInfoCardData {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly language?: ContentLanguage | null;
	readonly avatar?: PresentedAvatar | null;
	readonly slug?: string;
	readonly summary?: string;
}

export function RealmInfoCard({ realm }: { realm: RealmInfoCardData }) {
	const name = useChineseContentText(realm.name, realm.language);
	const initials = useChineseContentText(realm.initials, realm.language);
	const summary = useChineseContentText(realm.summary ?? "", realm.language);

	return (
		<div className="grid gap-3" data-slot="realm-info-card">
			<div className="flex min-w-0 items-center gap-3">
				<IdentityAvatar
					avatar={realm.avatar}
					className="size-12 text-base"
					fallback={initials}
					size="lg"
				/>
				<div className="min-w-0">
					<p className="truncate font-heading font-bold text-base">{name}</p>
					{realm.slug ? (
						<p className="truncate font-mono text-muted-foreground text-xs">/{realm.slug}</p>
					) : null}
				</div>
			</div>
			{summary ? (
				<p className="line-clamp-3 text-muted-foreground text-sm leading-5">{summary}</p>
			) : null}
		</div>
	);
}
