import { redirect } from "next/navigation";

import {
	studioSectionCreateHref,
	type StudioCreateSearchParams,
} from "@/features/create/model/studio-section";

export default async function Page({
	searchParams,
}: {
	searchParams: Promise<StudioCreateSearchParams>;
}) {
	redirect(studioSectionCreateHref("review", await searchParams));
}
