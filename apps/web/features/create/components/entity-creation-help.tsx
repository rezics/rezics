"use client";

import {
	Button,
	Dialog,
	DialogBody,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTrigger,
} from "@rezics/ui";
import { CircleHelp } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { useTranslation } from "@/i18n/client";

export function EntityCreationHelp() {
	const { t } = useTranslation(["create"]);
	const copy = t.create.entityHelp;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button aria-label={copy.label} size="icon-xs" type="button" variant="quiet">
					<CircleHelp aria-hidden />
				</Button>
			</DialogTrigger>
			<DialogContent showCloseButton={false} size="sm">
				<DialogHeader title={copy.title} />
				<DialogBody className="grid gap-3">
					<DialogDescription>{copy.description}</DialogDescription>
					<Link
						className="w-fit text-link text-sm hover:text-link-hover hover:underline"
						href="/create/entity"
					>
						{copy.createEntity}
					</Link>
				</DialogBody>
				<DialogFooter>
					<DialogClose asChild>
						<Button type="button" variant="outline">
							{copy.close}
						</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
