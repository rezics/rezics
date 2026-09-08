"use client";
import { useTranslation } from "@/i18n/client";
import type { DefinitionConstraints } from "../model/definition-draft";
import { DefinitionRevisionLabel } from "./definition-revision-picker";
export function DefinitionMeaning({ value }: { value: DefinitionConstraints }) {
	const { t } = useTranslation(["units", "create"]),
		copy = t.units.nativeDefinitions;
	const scalars = [
		{ label: copy.minimum, value: value.minimum },
		{ label: copy.maximum, value: value.maximum },
		{ label: copy.minLength, value: value.minLength },
		{ label: copy.maxLength, value: value.maxLength },
		{ label: copy.unit, value: value.unit },
	];
	return (
		<div className="grid gap-4">
			<dl className="grid gap-2 sm:grid-cols-2">
				{scalars
					.filter((item) => item.value !== undefined)
					.map((item) => (
						<div key={item.label}>
							<dt className="text-sm text-muted-foreground">{item.label}</dt>
							<dd>{item.value}</dd>
						</div>
					))}
				{value.nullable ? (
					<div>
						<dt>{copy.nullable}</dt>
						<dd>{t.units.nativeDomain.yes}</dd>
					</div>
				) : null}
				{value.integer ? (
					<div>
						<dt>{copy.integer}</dt>
						<dd>{t.units.nativeDomain.yes}</dd>
					</div>
				) : null}
			</dl>
			{value.allowedValues ? (
				<div>
					<h3 className="font-medium">{copy.allowedValues}</h3>
					<ul className="list-inside list-disc">
						{value.allowedValues.map((item, index) => (
							<li key={index}>
								{typeof item === "boolean"
									? item
										? t.units.nativeDomain.yes
										: t.units.nativeDomain.no
									: item}
							</li>
						))}
					</ul>
				</div>
			) : null}
			{value.targets?.length ? (
				<div>
					<h3 className="font-medium">{copy.targets}</h3>
					<ul>
						{value.targets.map((target, index) => (
							<li key={index}>
								{t.create.sections[target.owner].label}: {target.shapes.join(", ")}
							</li>
						))}
					</ul>
				</div>
			) : null}
			{value.slots?.length ? (
				<div>
					<h3 className="font-medium">{copy.slots}</h3>
					<p>{value.slots.join(", ")}</p>
				</div>
			) : null}
			{value.vocabularyRevisionId ? (
				<div>
					<h3>{copy.vocabulary}</h3>
					<DefinitionRevisionLabel id={value.vocabularyRevisionId} />
				</div>
			) : null}
			{value.roles?.length ? (
				<div className="grid gap-3">
					<h3 className="font-medium">{copy.roles}</h3>
					{value.roles.map((role) => (
						<div className="rounded-xl border p-3" key={role.roleRevisionId}>
							<DefinitionRevisionLabel id={role.roleRevisionId} />
							<dl className="my-2 grid grid-cols-2 gap-2">
								<div>
									<dt>{copy.minParticipants}</dt>
									<dd>{role.min}</dd>
								</div>
								<div>
									<dt>{copy.maxParticipants}</dt>
									<dd>{role.max}</dd>
								</div>
							</dl>
							<DefinitionMeaning
								value={{ targets: role.targets, nullable: false, integer: false }}
							/>
						</div>
					))}
				</div>
			) : null}
			{[
				{ ids: value.qualifierRevisionIds, label: copy.qualifiers },
				{ ids: value.memberRevisionIds, label: copy.members },
			].map((group) =>
				group.ids?.length ? (
					<div key={group.label}>
						<h3 className="font-medium">{group.label}</h3>
						<ul className="grid gap-2">
							{group.ids.map((id) => (
								<li key={id}>
									<DefinitionRevisionLabel id={id} />
								</li>
							))}
						</ul>
					</div>
				) : null,
			)}
			{value.rules?.length ? (
				<div className="grid gap-3">
					<h3 className="font-medium">{copy.rules}</h3>
					{value.rules.map((rule) => (
						<div className="rounded-xl border p-3" key={rule.position}>
							<p>
								{rule.position === 0 ? copy.root : (rule.memberKey ?? rule.position)} ·{" "}
								{copy.valueKinds[rule.kind]}
							</p>
							{rule.parent !== null ? (
								<p className="text-sm text-muted-foreground">
									{copy.parent}: {rule.parent}
								</p>
							) : null}
							<DefinitionMeaning value={rule} />
						</div>
					))}
				</div>
			) : null}
		</div>
	);
}
