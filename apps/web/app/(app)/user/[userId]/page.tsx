import { permanentRedirect } from "next/navigation";

import { profileHref } from "@/features/profiles/profile-route";

export default async function Page({ params }: { params: Promise<{ userId: string }> }) {
	permanentRedirect(profileHref((await params).userId));
}
