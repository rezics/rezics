"use client";

import GithubIcon from "@rezics/icons/components/brand/GithubIcon";
import { verbatimTerms } from "@rezics/i18n/verbatim-terms";
import { Card, CardContent } from "@rezics/ui";

import { useTranslation } from "@/i18n/client";

const RepositoryUrl = "https://github.com/rezics/rezics";
const ContactUrl = "https://about.rezics.com/contact-us/";

export function PreviewAccessNotice() {
	const { t } = useTranslation(["previewAccess"]);

	return (
		<section className="mx-auto grid min-h-80 w-full max-w-3xl place-items-center py-8">
			<Card appearance="outlined" className="w-full">
				<CardContent className="grid gap-5 p-6 sm:p-8">
					<div className="grid gap-2">
						<h2 className="font-heading text-2xl font-semibold tracking-tight">
							{t.previewAccess.title}
						</h2>
						<p className="text-sm leading-6 text-muted-foreground">{t.previewAccess.description}</p>
					</div>
					<p className="text-sm leading-6 text-muted-foreground">
						{t.previewAccess.openSourcePrefix}{" "}
						<a
							className="inline-flex items-center gap-1.5 font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-current"
							href={RepositoryUrl}
							rel="noreferrer"
							target="_blank"
						>
							<GithubIcon aria-hidden className="size-4" />
							{verbatimTerms.rezicsRepository.value}
						</a>
						{t.previewAccess.openSourceSuffix}
					</p>
					<p className="text-sm leading-6 text-muted-foreground">
						{t.previewAccess.participationPrefix}{" "}
						<a
							className="font-medium text-foreground underline decoration-border underline-offset-4 hover:decoration-current"
							href={ContactUrl}
							rel="noreferrer"
							target="_blank"
						>
							{t.previewAccess.contact}
						</a>
						{t.previewAccess.participationSuffix}
					</p>
				</CardContent>
			</Card>
		</section>
	);
}
