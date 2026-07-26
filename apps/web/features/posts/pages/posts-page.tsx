"use client";

import { Button, PageHeading } from "@rezics/ui";
import Link from "next/link";

import { useTranslation } from "@/i18n/client";
import { PostList } from "../post-list";

export function PostsPage() {
	const { t } = useTranslation(["posts"]);
	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				action={
					<Button asChild variant="solid">
						<Link href="/posts/new">{t.posts.create}</Link>
					</Button>
				}
				title={t.posts.title}
			/>
			<PostList />
		</main>
	);
}
