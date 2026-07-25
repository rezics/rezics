"use client";

import { ScopedSearchPage } from "@/features/search/search-page";
import { useProfileContext } from "./profile-layout";

export function ProfileSearchPage() {
	const { profile } = useProfileContext();
	return (
		<ScopedSearchPage
			contexts={[{ kind: "profile", profileId: profile.id }]}
			embedded
			id={`profile-${profile.id}-search`}
			source={{ kind: "template", template: "global" }}
		/>
	);
}
