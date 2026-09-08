import { notFound, redirect } from "next/navigation";

import {
	studioSectionCreateHref,
	type StudioCreateSearchParams,
} from "@/features/create/model/studio-section";
import { isUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ type: string }>;
	searchParams: Promise<StudioCreateSearchParams>;
}) {
	const [{ type }, query] = await Promise.all([params, searchParams]);
	if (!isUnitType(type)) notFound();
	redirect(studioSectionCreateHref(type, query));
}
