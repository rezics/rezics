import { permanentRedirect } from "next/navigation";

import { profileHref } from "@/features/profiles/profile-route";

export default async function Page({ params }: { params: Promise<{ profileId: string }> }) {
	permanentRedirect(profileHref((await params).profileId));
}
