"use client";

import {
	type GetApiRealmsByRealmIdStatus200,
	usePatchApiRealmsByRealmId,
} from "@rezics/openapi-tanstack-query";
import { Field, FieldContent, FieldDescription, FieldLabel, Switch } from "@rezics/ui";
import { useQueryClient } from "@tanstack/react-query";

import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { invalidateRealmDetails } from "../query";

export function RealmTagVotingSettings({
	realm,
}: {
	readonly realm: GetApiRealmsByRealmIdStatus200;
}) {
	const { t } = useTranslation("realms");
	const queryClient = useQueryClient();
	const update = usePatchApiRealmsByRealmId();
	const pendingValue = update.isPending
		? update.variables?.body.realmTagVotingEnabled
		: undefined;

	async function setEnabled(enabled: boolean) {
		try {
			await update.mutateAsync({
				path: { realmId: realm.id },
				body: { realmTagVotingEnabled: enabled },
			});
			await invalidateRealmDetails(queryClient, realm.id);
		} catch {
			// The typed mutation error is rendered below.
		}
	}

	return (
		<div className="grid gap-4">
			<div className="grid gap-1">
				<h2 className="font-heading font-bold text-xl">{t.tagVotingSettings.title}</h2>
				<p className="max-w-3xl text-muted-foreground text-sm">
					{t.tagVotingSettings.description}
				</p>
			</div>
			<Field className="rounded-xl border bg-muted/24 p-4" orientation="horizontal">
				<FieldContent>
					<FieldLabel>{t.tagVotingSettings.enabled}</FieldLabel>
					<FieldDescription>{t.tagVotingSettings.enabledDescription}</FieldDescription>
				</FieldContent>
				<Switch
					aria-label={t.tagVotingSettings.enabled}
					checked={pendingValue ?? realm.realmTagVotingEnabled}
					disabled={update.isPending}
					onCheckedChange={({ checked }) => void setEnabled(checked === true)}
				/>
			</Field>
			<RequestFailure error={update.error} />
		</div>
	);
}
