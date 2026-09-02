import { redirect } from "next/navigation";

import { StudioTagPathCreateHref } from "@/features/create/model/studio-section";

export default function Page() {
	redirect(StudioTagPathCreateHref);
}
