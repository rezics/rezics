"use client";

import type { PostApiTagRelationsRequestRelationKindEnum } from "@rezics/openapi-tanstack-query";
import { Button, EntityPicker, NativeSelect, NativeSelectOption } from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { TagPathPath } from "./tag-path";

export interface EditableTagPathMember {
	readonly id: string;
	readonly label: string;
}

export type EditableTagRelationKind = PostApiTagRelationsRequestRelationKindEnum;
const RelationKinds = [
	"generic",
	"partitive",
	"instance",
	"organizational",
	"facet_value",
] as const satisfies readonly EditableTagRelationKind[];

export function TagPathMemberEditor({
	members,
	onChange,
	onRelationKindsChange,
	relationKinds,
}: {
	readonly members: readonly EditableTagPathMember[];
	readonly onChange: (members: EditableTagPathMember[]) => void;
	readonly onRelationKindsChange: (relationKinds: EditableTagRelationKind[]) => void;
	readonly relationKinds: readonly EditableTagRelationKind[];
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const [picked, setPicked] = useState<EditableTagPathMember>();
	const add = () => {
		if (!picked || members.some(({ id }) => id === picked.id) || members.length >= 16) return;
		onChange([...members, picked]);
		onRelationKindsChange(members.length ? [...relationKinds, "generic"] : []);
		setPicked(undefined);
	};
	const move = (index: number, offset: -1 | 1) => {
		const target = index + offset;
		if (target < 0 || target >= members.length) return;
		const next = [...members];
		const [member] = next.splice(index, 1);
		if (!member) return;
		next.splice(target, 0, member);
		onChange(next);
		onRelationKindsChange(Array.from({ length: next.length - 1 }, () => "generic"));
	};
	const remove = (memberId: string) => {
		const next = members.filter(({ id }) => id !== memberId);
		onChange(next);
		onRelationKindsChange(Array.from({ length: Math.max(0, next.length - 1) }, () => "generic"));
	};
	const relationLabel = (kind: string) =>
		t.tags.expressions.relations[kind as keyof typeof t.tags.expressions.relations] ??
		t.tags.expressions.relationFallback;

	return (
		<>
			<div className="grid gap-2">
				<h2 className="font-semibold">{t.tags.createPath.pick}</h2>
				<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
					<EntityPicker
						ariaLabel={t.tags.createPath.pick}
						index="tags"
						onChange={setPicked}
						placeholder={t.ui.pickerPlaceholders.tag}
						value={picked}
					/>
					<Button
						disabled={!picked || members.some(({ id }) => id === picked.id) || members.length >= 16}
						onClick={add}
						type="button"
						variant="outline"
					>
						{t.tags.createPath.addMember}
					</Button>
				</div>
			</div>
			<div className="grid gap-3">
				<h2 className="font-semibold">{t.tags.createPath.preview}</h2>
				{members.length ? (
					<>
						<TagPathPath
							ariaLabel={t.tags.paths.pathLabel}
							fallback={t.tags.paths.memberFallback}
							members={members.map((member, index) => ({
								nodeId: member.id,
								nodeKind: "concept" as const,
								language: null,
								title: member.label,
								incomingRelation:
									index > 0 ? { relationKind: relationKinds[index - 1] ?? "generic" } : null,
							}))}
							relationLabel={relationLabel}
						/>
						<ol className="grid gap-2">
							{members.map((member, index) => (
								<li
									className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-weak p-3"
									key={member.id}
								>
									<div className="grid min-w-48 gap-1">
										<span className="font-medium">{member.label}</span>
										{index > 0 ? (
											<label className="grid gap-1 text-xs text-muted-foreground">
												<span>{t.tags.createPath.relationKind}</span>
												<NativeSelect
													onChange={(event) => {
														const next = [...relationKinds];
														next[index - 1] = event.currentTarget.value as EditableTagRelationKind;
														onRelationKindsChange(next);
													}}
													value={relationKinds[index - 1] ?? "generic"}
												>
													{RelationKinds.map((kind) => (
														<NativeSelectOption key={kind} value={kind}>
															{relationLabel(kind)}
														</NativeSelectOption>
													))}
												</NativeSelect>
											</label>
										) : null}
									</div>
									<div className="flex flex-wrap gap-2">
										<Button
											disabled={index === 0}
											onClick={() => move(index, -1)}
											type="button"
											variant="quiet"
										>
											{t.tags.createPath.moveEarlier}
										</Button>
										<Button
											disabled={index === members.length - 1}
											onClick={() => move(index, 1)}
											type="button"
											variant="quiet"
										>
											{t.tags.createPath.moveLater}
										</Button>
										<Button onClick={() => remove(member.id)} type="button" variant="quiet">
											{t.tags.createPath.removeMember}
										</Button>
									</div>
								</li>
							))}
						</ol>
					</>
				) : (
					<p className="text-sm text-muted-foreground">{t.tags.createPath.minimum}</p>
				)}
			</div>
		</>
	);
}
