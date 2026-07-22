import { Avatar, AvatarFallback, AvatarImage } from "@rezics/ui";

export interface ProfileInfoCardData {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly avatarUrl?: string;
	readonly slug?: string;
	readonly summary?: string;
}

export function ProfileInfoCard({ profile }: { profile: ProfileInfoCardData }) {
	return (
		<div className="grid gap-3" data-slot="profile-info-card">
			<div className="flex min-w-0 items-center gap-3">
				<Avatar className="size-12 text-base" size="lg">
					{profile.avatarUrl ? <AvatarImage alt="" src={profile.avatarUrl} /> : null}
					<AvatarFallback>{profile.initials}</AvatarFallback>
				</Avatar>
				<div className="min-w-0">
					<p className="truncate font-heading font-bold text-base">{profile.name}</p>
					{profile.slug ? (
						<p className="truncate font-mono text-muted-foreground text-xs">
							@{profile.slug}
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
