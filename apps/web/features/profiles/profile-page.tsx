"use client";

import { Card, CardContent, CardHeader, CardTitle, PortableTextContent } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";
import { readPortableText } from "@/lib/block";
import { useProfileContext } from "./profile-layout";

export function ProfilePage() {
	const { t } = useTranslation(["profiles"]);
	const { profile } = useProfileContext();
	const hasDescription = Boolean(profile.description?.content.length);

	return (
		<section aria-labelledby="profile-about-title" className="max-w-3xl">
			<Card className="rounded-2xl shadow-none">
				<CardHeader>
					<CardTitle asChild>
						<h2 id="profile-about-title">{t.profiles.aboutTitle}</h2>
					</CardTitle>
				</CardHeader>
				<CardContent>
					{hasDescription ? (
						<PortableTextContent
							value={readPortableText(profile.description)}
							variant="article"
						/>
					) : (
						<p className="text-muted-foreground text-sm leading-6">
							{t.profiles.aboutEmpty}
						</p>
					)}
				</CardContent>
			</Card>
		</section>
	);
}
