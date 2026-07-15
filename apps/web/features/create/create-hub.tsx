"use client";

import {
	BookOpen,
	ClipboardPenLine,
	FolderPlus,
	Landmark,
	MessageSquareText,
	Tags,
	Vote,
} from "lucide-react";
import Link from "next/link";

import { PageHeading } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { useTranslation } from "@/i18n/client";

const Destinations = [
	{ href: "/units/book/new", key: "book", icon: BookOpen },
	{ href: "/units/game/new", key: "game", icon: BookOpen },
	{ href: "/units/media/new", key: "media", icon: BookOpen },
	{ href: "/entities/new", key: "entity", icon: Landmark },
	{ href: "/tags/new", key: "tag", icon: Tags },
	{ href: "/realms/new", key: "realm", icon: Landmark },
	{ href: "/posts/new", key: "post", icon: MessageSquareText },
	{ href: "/collections/new", key: "collection", icon: FolderPlus },
	{ href: "/reviews/new", key: "review", icon: ClipboardPenLine },
	{ href: "/polls/new", key: "poll", icon: Vote },
] as const;

export function CreateHub() {
	const { t } = useTranslation({ suspense: true });
	return (
		<RequireSession>
			<main className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 py-10 sm:px-6">
				<PageHeading title={t.create.title} description={t.create.description} />
				<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
					{Destinations.map(({ href, key, icon: Icon }) => (
						<Link key={href} href={href}>
							<Card className="h-full transition-colors hover:border-primary/40">
								<CardContent className="flex min-h-36 flex-col gap-3 p-5">
									<Icon className="text-primary size-5" />
									<h2 className="font-semibold">{t.create.items[key]}</h2>
								</CardContent>
							</Card>
						</Link>
					))}
				</div>
			</main>
		</RequireSession>
	);
}
