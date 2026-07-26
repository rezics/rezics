import type { PresentedAvatar } from "@rezics/avatar";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { IdentityAvatar } from "@rezics/ui";

export interface ProfileInfoCardData {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly avatar?: PresentedAvatar | null;
	readonly slug?: string;
	readonly summary?: string;
}

export function ProfileInfoCard({ profile }: { profile: ProfileInfoCardData }) {
	return (
		<div className="grid gap-3" data-slot="profile-info-card">
			<div className="flex min-w-0 items-center gap-3">
				<IdentityAvatar
					avatar={profile.avatar}
					className="size-12 text-base"
					fallback={profile.initials}
					size="lg"
				/>
				<div className="min-w-0">
					<p className="truncate font-heading font-bold text-base">{profile.name}</p>
					{profile.slug ? (
						<p className="truncate font-mono text-muted-foreground text-xs">
							{verbatimTerms.profileSlugPrefix.value}
							{profile.slug}
						</p>
					) : null}
				</div>
			</div>
			{profile.summary ? (
				<p className="line-clamp-3 text-muted-foreground text-sm leading-5">
					{profile.summary}
				</p>
			) : null}
		</div>
	);
}
