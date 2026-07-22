import type { PresentedAvatar } from "@rezics/avatar";
import { IdentityAvatar } from "@rezics/ui";

export interface RealmInfoCardData {
	readonly id: string;
	readonly name: string;
	readonly initials: string;
	readonly avatar?: PresentedAvatar | null;
	readonly slug?: string;
	readonly summary?: string;
}

export function RealmInfoCard({ realm }: { realm: RealmInfoCardData }) {
	return (
		<div className="grid gap-3" data-slot="realm-info-card">
			<div className="flex min-w-0 items-center gap-3">
				<IdentityAvatar
					avatar={realm.avatar}
					className="size-12 text-base"
					fallback={realm.initials}
					size="lg"
				/>
				<div className="min-w-0">
					<p className="truncate font-heading font-bold text-base">{realm.name}</p>
					{realm.slug ? (
						<p className="truncate font-mono text-muted-foreground text-xs">
							/{realm.slug}
						</p>
					) : null}
				</div>
			</div>
			{realm.summary ? (
				<p className="line-clamp-3 text-muted-foreground text-sm leading-5">
					{realm.summary}
				</p>
			) : null}
		</div>
	);
}
