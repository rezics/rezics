import { notFound, redirect } from "next/navigation";

import {
	studioSectionCreateHref,
	type StudioCreateSearchParams,
} from "@/features/create/model/studio-section";
import { UnitCreatePage } from "@/features/units/unit-pages";
import { isWorkUnitType } from "@/features/units/unit-types";

export default async function Page({
	params,
	searchParams,
}: {
	params: Promise<{ type: string }>;
	searchParams: Promise<StudioCreateSearchParams>;
}) {
	const [{ type }, query] = await Promise.all([params, searchParams]);
	if (!isWorkUnitType(type)) notFound();
	if (type !== "series") redirect(studioSectionCreateHref(type, query));
	return <UnitCreatePage type={type} />;
}
