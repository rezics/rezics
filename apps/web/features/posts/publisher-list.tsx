import Link from "next/link";
import type { PublicSlugAddressValue } from "@rezics/slug";

import { profileHref } from "@/features/profiles/profile-route";

export type PublisherSummary = {
	readonly profileId: string;
	readonly slugAddress?: PublicSlugAddressValue | null;
	readonly name: string | null;
};

export function PublisherLinks({
	publishers,
	emptyLabel,
	className,
}: {
	readonly publishers: readonly PublisherSummary[];
	readonly emptyLabel: string;
	readonly className?: string;
}) {
	if (!publishers.length) return <span className={className}>{emptyLabel}</span>;
	return publishers.map((publisher, index) => (
		<span key={publisher.profileId}>
			{index > 0 ? ", " : null}
			<Link
				className={className}
				href={profileHref({ id: publisher.profileId, slugAddress: publisher.slugAddress })}
			>
				{publisher.name ?? emptyLabel}
			</Link>
		</span>
	));
}

export function firstPublisher(publishers: readonly PublisherSummary[]) {
	return publishers[0];
}
