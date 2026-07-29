"use client";

import {
	Button,
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTrigger,
} from "@rezics/ui";
import { Import, KeyRound } from "lucide-react";

import { AppLink as Link } from "@/features/application-shell/components/app-link";
import { settingsSectionHref } from "@/features/settings/routing/settings-routes";
import { useTranslation } from "@/i18n/client";

export function ProgressImportDialog({ variant }: { readonly variant: "outline" | "quiet" }) {
	const { t } = useTranslation(["engagement"]);
	const copy = t.engagement.progressJournal;

	return (
		<Dialog>
			<DialogTrigger asChild>
				<Button type="button" variant={variant}>
					<Import aria-hidden data-icon="inline-start" />
					{copy.importHistory}
				</Button>
			</DialogTrigger>
			<DialogContent size="sm">
				<DialogHeader description={copy.importHelpDescription} title={copy.importHistory} />
				<DialogFooter>
					<Button asChild variant="solid">
						<Link href={settingsSectionHref("tokens")}>
							<KeyRound aria-hidden data-icon="inline-start" />
							{copy.openApiTokens}
						</Link>
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
