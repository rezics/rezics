"use client";

import { PageHeading } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { OwnMemberships } from "../components/own-memberships";
import { OrganizationMembershipManager } from "../components/organization-membership-manager";

export function MembershipSettingsPage() {
	const { t } = useTranslation(["settings"]);
	return (
		<section className="grid max-w-4xl gap-6">
			<PageHeading
				title={t.settings.memberships.title}
				description={t.settings.memberships.description}
			/>
			<OwnMemberships />
			<OrganizationMembershipManager />
		</section>
	);
}
