"use client";

import { ManagementWorkspaceSectionHeader } from "@rezics/ui";
import Link from "next/link";

import { ReceivedAccessInvitations } from "@/features/governance/unit-workflows";
import { useTranslation } from "@/i18n/client";
import { SettingsOverviewHref } from "../routing/settings-routes";

export function InvitationsSettingsPage() {
	const { t } = useTranslation(["governance", "settings"]);
	return (
		<section>
			<ManagementWorkspaceSectionHeader
				backHref={SettingsOverviewHref}
				backLabel={t.settings.workspace.backToOverview}
				link={Link}
				title={t.governance.receivedInvitations}
			/>
			<ReceivedAccessInvitations />
		</section>
	);
}
