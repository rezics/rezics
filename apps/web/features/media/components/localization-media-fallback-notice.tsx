"use client";

import {
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@rezics/ui";
import { X } from "lucide-react";

import { useTranslation } from "@/i18n/client";

export function LocalizationMediaFallbackNotice() {
	const { t } = useTranslation(["media"]);
	const copy = t.media.localizationFallback;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button
					className="h-auto min-h-0 w-fit max-w-full justify-start whitespace-normal p-0 text-start text-sm"
					type="button"
					variant="link"
				>
					{copy.notice}
				</Button>
			</DialogTrigger>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader className="flex-row items-start justify-between gap-4">
					<div className="grid gap-2">
						<DialogTitle>{copy.title}</DialogTitle>
						<DialogDescription>{copy.description}</DialogDescription>
					</div>
					<DialogClose asChild>
						<Button
							aria-label={copy.close}
							className="shrink-0"
							size="icon-sm"
							type="button"
							variant="quiet"
						>
							<X aria-hidden />
						</Button>
					</DialogClose>
				</DialogHeader>
				<DialogBody>
					<ul className="grid list-disc gap-3 ps-5 text-sm">
						<li>{copy.viewerPreferences}</li>
						<li>{copy.defaultOrder}</li>
						<li>{copy.noImage}</li>
						<li>{copy.textDifference}</li>
					</ul>
					<p className="mt-5 rounded-md bg-muted p-3 text-muted-foreground text-sm">
						{copy.example}
					</p>
				</DialogBody>
			</DialogContent>
		</Dialog>
	);
}
