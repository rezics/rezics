"use client";

import { Button, EntityPicker } from "@rezics/ui";
import { useState } from "react";

import { useTranslation } from "@/i18n/client";
import { TagPathPath } from "./tag-path";

export interface EditableTagPathMember {
	readonly id: string;
	readonly label: string;
}

export function TagPathMemberEditor({
	members,
	onChange,
}: {
	readonly members: readonly EditableTagPathMember[];
	readonly onChange: (members: EditableTagPathMember[]) => void;
}) {
	const { t } = useTranslation(["tags", "ui"]);
	const [picked, setPicked] = useState<EditableTagPathMember>();
	const add = () => {
		if (!picked || members.some(({ id }) => id === picked.id) || members.length >= 16) return;
		onChange([...members, picked]);
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
	};

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
							members={members.map((member) => ({
								tagId: member.id,
								language: null,
								title: member.label,
							}))}
						/>
						<ol className="grid gap-2">
							{members.map((member, index) => (
								<li
									className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border-weak p-3"
									key={member.id}
								>
									<span className="font-medium">{member.label}</span>
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
										<Button
											onClick={() => onChange(members.filter(({ id }) => id !== member.id))}
											type="button"
											variant="quiet"
										>
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
