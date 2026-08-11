"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { createDockTarget, isDockKind, type DockKind, type DockOwnerKind } from "../model/dock";
import { UnitDockManager } from "./unit-dock-manager";

export function UnitDockSettings({
	allowedKinds,
	ownerKind,
	ownerUnitId,
}: {
	readonly allowedKinds: readonly DockKind[];
	readonly ownerKind: DockOwnerKind;
	readonly ownerUnitId: string;
}) {
	const { t } = useTranslation("docks");
	const firstKind = allowedKinds[0];
	const [selectedKind, setSelectedKind] = useState<DockKind | undefined>(firstKind);
	if (!firstKind) return null;
	const activeKind = selectedKind && allowedKinds.includes(selectedKind) ? selectedKind : firstKind;
	if (allowedKinds.length === 1) {
		const target = createDockTarget(ownerKind, firstKind);
		return target ? <UnitDockManager ownerUnitId={ownerUnitId} target={target} /> : null;
	}
	return (
		<Tabs
			onValueChange={({ value }) => {
				if (isDockKind(value) && allowedKinds.includes(value)) setSelectedKind(value);
			}}
			value={activeKind}
		>
			<TabsList aria-label={t.kinds.navigation} variant="underline">
				{allowedKinds.map((kind) => (
					<TabsTrigger key={kind} value={kind}>
						{t.kinds[kind].label}
					</TabsTrigger>
				))}
			</TabsList>
			{allowedKinds.map((kind) => {
				const target = createDockTarget(ownerKind, kind);
				return target ? (
					<TabsContent className="pt-6" key={kind} value={kind}>
						<UnitDockManager ownerUnitId={ownerUnitId} target={target} />
					</TabsContent>
				) : null;
			})}
		</Tabs>
	);
}
