"use client";

import { PageHeading } from "@rezics/ui";
import { useRouter } from "next/navigation";

import { RequireSession } from "@/features/auth/require-session";
import { postHref } from "@/features/posts/url";
import { useTranslation } from "@/i18n/client";
import { ReviewComposer } from "../components/review-composer";

export function ReviewCreatePage() {
	const router = useRouter();
	const { t } = useTranslation(["engagement"]);
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.engagement.newReview} />
				<ReviewComposer onCreated={(reviewId) => router.push(postHref(reviewId))} />
			</main>
		</RequireSession>
	);
}
