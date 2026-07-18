"use client";

import {
	getApiRealmsByRealmIdMembersQueryKey,
	getApiRealmsByRealmIdPinsQueryKey,
	getApiRealmsByRealmIdRulesQueryKey,
	useDeleteApiRealmsByRealmIdPinsByUnitId,
	useGetApiPosts,
	useGetApiRealmsByRealmId,
	useGetApiRealmsByRealmIdMembers,
	useGetApiRealmsByRealmIdPins,
	useGetApiRealmsByRealmIdRules,
	usePatchApiRealmsByRealmId,
	usePatchApiRealmsByRealmIdUnitsByUnitId,
	usePatchApiRealmsByRealmIdMembersByProfileId,
	usePutApiRealmsByRealmIdPinsByUnitId,
	usePutApiRealmsByRealmIdRules,
	type GetApiRealmsByRealmIdRulesStatus200,
	type GetApiRealmsByRealmIdStatus200,
} from "@rezics/openapi-tanstack-query";
import type { PortableTextDocument } from "@rezics/content-structure";
import type { PortableTextValue } from "@rezics/portable-text";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { EntityPicker } from "@rezics/ui";
import { PageHeading } from "@rezics/ui";
import { QueryFailure, QueryPending } from "@rezics/ui";
import { Button } from "@rezics/ui";
import { Card, CardContent } from "@rezics/ui";
import { Checkbox } from "@rezics/ui";
import { Field, FieldGroup, FieldLabel } from "@rezics/ui";
import { Input } from "@rezics/ui";
import { NativeSelect, NativeSelectOption } from "@rezics/ui";
import { Skeleton } from "@rezics/ui";
import { Textarea } from "@rezics/ui";
import { RequireSession } from "@/features/auth/require-session";
import { PortableTextEditor } from "@/features/editor/portable-text-editor";
import { invalidatePostQueries } from "@/features/posts/query";
import { useTranslation } from "@/i18n/client";
import { RequestFailure } from "@/i18n/request-failure";
import { readPortableText, writePortableText } from "@/lib/content-structure";
import { selectLocalization } from "@/lib/localization";
import { canManageRealm } from "./realm-permissions";
import { invalidateRealmDetails } from "./query";

const MemberRoles = ["owner", "admin", "moderator", "member"] as const;
const MemberStates = ["active", "pending", "muted", "removed", "banned"] as const;
const RealmUnitStates = ["pending", "visible", "hidden", "removed"] as const;

type PickedEntity = { id: string; label: string };
type RuleDraft = {
	language: string;
	title: string;
	content: PortableTextValue;
	document?: PortableTextDocument;
};
type MemberRole = (typeof MemberRoles)[number];
type MemberState = (typeof MemberStates)[number];

export function RealmSettingsPage({ id }: { id: string }) {
	return (
		<RequireSession>
			<RealmSettingsContent id={id} />
		</RequireSession>
	);
}

function RealmSettingsContent({ id }: { id: string }) {
	const { t } = useTranslation({ suspense: true });
	const realm = useGetApiRealmsByRealmId({ path: { realmId: id } });
	const mayManage = canManageRealm(realm.data?.viewerMembership);
	const members = useGetApiRealmsByRealmIdMembers(
		{ path: { realmId: id }, query: { limit: 100 } },
		{
			query: { enabled: mayManage },
		},
	);
	const rules = useGetApiRealmsByRealmIdRules(
		{ path: { realmId: id } },
		{ query: { enabled: mayManage } },
	);
	const pins = useGetApiRealmsByRealmIdPins(
		{ path: { realmId: id } },
		{ query: { enabled: mayManage } },
	);
	const posts = useGetApiPosts(
		{ query: { realmId: id, limit: 50 } },
		{ query: { enabled: mayManage } },
	);

	if (realm.isError)
		return <QueryFailure error={realm.error} retry={() => void realm.refetch()} />;
	if (!realm.data) return <QueryPending />;
	if (!mayManage)
		return (
			<main className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
				<p className="text-destructive text-sm">{t.errors.forbidden}</p>
			</main>
		);

	return (
		<main className="mx-auto flex w-full max-w-4xl flex-col gap-8 px-4 py-10 sm:px-6">
			<PageHeading
				title={t.realms.settings}
				action={
					<Button variant="outline" asChild>
						<Link href={`/realms/${realm.data.id}`}>{t.realms.backToRealm}</Link>
					</Button>
				}
			/>
			<RealmProfileSettings realm={realm.data} />
			<RealmMembers
				realmId={realm.data.id}
				members={members.data?.items}
				pending={members.isPending}
				error={members.error}
			/>
			<RealmRules
				realmId={realm.data.id}
				data={rules.data}
				pending={rules.isPending}
				error={rules.error}
			/>
			<RealmPins
				realmId={realm.data.id}
				pins={pins.data?.items}
				pending={pins.isPending}
				error={pins.error}
			/>
			<RealmModeration
				realmId={realm.data.id}
				posts={posts.data?.items}
				pending={posts.isPending}
				error={posts.error}
			/>
		</main>
	);
}

function RealmProfileSettings({ realm }: { realm: GetApiRealmsByRealmIdStatus200 }) {
	const { t, locale } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const update = usePatchApiRealmsByRealmId();
	const localization = selectLocalization(realm.localizations, locale.target, realm.language);

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const data = new FormData(event.currentTarget);
		const title = String(data.get("title") ?? "").trim();
		const summary = String(data.get("summary") ?? "").trim();
		if (!title) return;
		const submittedStatus = data.get("status");
		const submittedVisibility = data.get("visibility");
		const status =
			submittedStatus === "published" || submittedStatus === "archived"
				? submittedStatus
				: "draft";
		const visibility =
			submittedVisibility === "unlisted" || submittedVisibility === "private"
				? submittedVisibility
				: "public";
		update.mutate(
			{
				path: { realmId: realm.id },
				body: {
					status,
					visibility,
					joinPolicy: data.get("joinPolicy") === "approval" ? "approval" : "open",
					localization: {
						language: localization?.language ?? locale.target,
						title,
						...(summary ? { summary } : {}),
					},
				},
			},
			{
				onSuccess: () => invalidateRealmDetails(queryClient, realm.id),
			},
		);
	}

	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.realms.profile}</h2>
			<Card>
				<CardContent className="p-5">
					<form onSubmit={submit}>
						<FieldGroup>
							<Field required>
								<FieldLabel>{t.ui.title}</FieldLabel>
								<Input
									name="title"
									required
									maxLength={500}
									defaultValue={localization?.title ?? ""}
								/>
							</Field>
							<Field>
								<FieldLabel>{t.ui.summary}</FieldLabel>
								<Textarea
									name="summary"
									maxLength={2000}
									defaultValue={localization?.summary ?? ""}
								/>
							</Field>
							<div className="grid gap-4 sm:grid-cols-3">
								<Field>
									<FieldLabel>{t.ui.status}</FieldLabel>
									<NativeSelect name="status" defaultValue={realm.status}>
										<NativeSelectOption value="draft">
											{t.ui.draft}
										</NativeSelectOption>
										<NativeSelectOption value="published">
											{t.ui.published}
										</NativeSelectOption>
										<NativeSelectOption value="archived">
											{t.ui.archived}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.ui.visibility}</FieldLabel>
									<NativeSelect name="visibility" defaultValue={realm.visibility}>
										<NativeSelectOption value="public">
											{t.ui.public}
										</NativeSelectOption>
										<NativeSelectOption value="unlisted">
											{t.ui.unlisted}
										</NativeSelectOption>
										<NativeSelectOption value="private">
											{t.ui.private}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
								<Field>
									<FieldLabel>{t.realms.joinPolicy}</FieldLabel>
									<NativeSelect name="joinPolicy" defaultValue={realm.joinPolicy}>
										<NativeSelectOption value="open">
											{t.realms.open}
										</NativeSelectOption>
										<NativeSelectOption value="approval">
											{t.realms.approval}
										</NativeSelectOption>
									</NativeSelect>
								</Field>
							</div>
							<RequestFailure error={update.error} />
							<Button type="submit" className="w-fit" isLoading={update.isPending}>
								{t.ui.save}
							</Button>
						</FieldGroup>
					</form>
				</CardContent>
			</Card>
		</section>
	);
}

function RealmMembers({
	realmId,
	members,
	pending,
	error,
}: {
	realmId: string;
	members:
		| readonly { profileId: string; name: string | null; role: string; state: string }[]
		| undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation({ suspense: true });
	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.realms.members}</h2>
			{pending ? (
				<Skeleton className="h-48 rounded-xl" />
			) : error ? (
				<RequestFailure error={error} />
			) : members?.length ? (
				<div className="grid gap-3">
					{members.map((member) => (
						<RealmMember key={member.profileId} realmId={realmId} member={member} />
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.state.empty}</p>
			)}
		</section>
	);
}

function RealmMember({
	realmId,
	member,
}: {
	realmId: string;
	member: { profileId: string; name: string | null; role: string; state: string };
}) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const update = usePatchApiRealmsByRealmIdMembersByProfileId();
	const [role, setRole] = useState<MemberRole>(toMemberRole(member.role));
	const [state, setState] = useState<MemberState>(toMemberState(member.state));
	return (
		<Card>
			<CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_9rem_9rem_auto] sm:items-end">
				<div className="min-w-0">
					<p className="truncate font-medium">{member.name ?? t.realms.unknownMember}</p>
				</div>
				<Field>
					<FieldLabel>{t.realms.memberRole}</FieldLabel>
					<NativeSelect
						value={role}
						onChange={(event) => setRole(toMemberRole(event.currentTarget.value))}
					>
						{MemberRoles.map((value) => (
							<NativeSelectOption key={value} value={value}>
								{t.realms.roles[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<Field>
					<FieldLabel>{t.realms.memberState}</FieldLabel>
					<NativeSelect
						value={state}
						onChange={(event) => setState(toMemberState(event.currentTarget.value))}
					>
						{MemberStates.map((value) => (
							<NativeSelectOption key={value} value={value}>
								{t.realms.memberStates[value]}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</Field>
				<div className="grid gap-2">
					<Button
						size="sm"
						isLoading={update.isPending}
						onClick={() =>
							update.mutate(
								{
									path: { realmId, profileId: member.profileId },
									body: { role, state },
								},
								{
									onSuccess: async () => {
										await Promise.all([
											queryClient.invalidateQueries({
												queryKey: getApiRealmsByRealmIdMembersQueryKey({
													path: { realmId },
												}),
											}),
											invalidateRealmDetails(queryClient, realmId),
										]);
									},
								},
							)
						}
					>
						{t.ui.save}
					</Button>
					<RequestFailure error={update.error} />
				</div>
			</CardContent>
		</Card>
	);
}

function RealmRules({
	realmId,
	data,
	pending,
	error,
}: {
	realmId: string;
	data: GetApiRealmsByRealmIdRulesStatus200 | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t, locale } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const save = usePutApiRealmsByRealmIdRules();
	const [drafts, setDrafts] = useState<RuleDraft[]>();
	const [requireOnJoin, setRequireOnJoin] = useState(false);
	const [requireOnPost, setRequireOnPost] = useState(false);
	const [requireOnUpdate, setRequireOnUpdate] = useState(false);

	useEffect(() => {
		if (!data) return;
		setDrafts(
			data.items.length
				? data.items.map((rule) => ({
						language: rule.language,
						title: rule.title,
						content: readPortableText(rule.content),
						document: rule.content,
					}))
				: [{ language: locale.target, title: "", content: [] }],
		);
		setRequireOnJoin(Boolean(data.requireOnJoin));
		setRequireOnPost(Boolean(data.requireOnPost));
		setRequireOnUpdate(Boolean(data.requireOnUpdate));
	}, [data, locale.target]);

	if (error)
		return (
			<section>
				<RequestFailure error={error} />
			</section>
		);
	if (pending || !drafts)
		return (
			<section>
				<Skeleton className="h-64 rounded-xl" />
			</section>
		);
	const currentDrafts = drafts;

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const rules = currentDrafts.filter((rule) => rule.title.trim());
		if (!rules.length) return;
		save.mutate(
			{
				path: { realmId },
				body: {
					requireOnJoin,
					requireOnPost,
					requireOnUpdate,
					rules: rules.map((rule) => ({
						language: rule.language,
						title: rule.title.trim(),
						content: writePortableText(rule.content, rule.document),
					})),
				},
			},
			{
				onSuccess: () =>
					queryClient.invalidateQueries({
						queryKey: getApiRealmsByRealmIdRulesQueryKey({ path: { realmId } }),
					}),
			},
		);
	}

	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.realms.rules}</h2>
			<Card>
				<CardContent className="p-5">
					<form className="grid gap-5" onSubmit={submit}>
						<div className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
							<RuleRequirement checked={requireOnJoin} onChange={setRequireOnJoin}>
								{t.realms.requireOnJoin}
							</RuleRequirement>
							<RuleRequirement checked={requireOnPost} onChange={setRequireOnPost}>
								{t.realms.requireOnPost}
							</RuleRequirement>
							<RuleRequirement
								checked={requireOnUpdate}
								onChange={setRequireOnUpdate}
							>
								{t.realms.requireOnUpdate}
							</RuleRequirement>
						</div>
						{drafts.map((rule, index) => (
							<div
								key={`${rule.language}:${index}`}
								className="grid gap-3 border-t pt-5"
							>
								<div className="grid gap-3 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
									<Field>
										<FieldLabel>{t.realms.ruleLanguage}</FieldLabel>
										<Input
											value={rule.language}
											onChange={(event) =>
												setDrafts((current) =>
													current?.map((item, itemIndex) =>
														itemIndex === index
															? {
																	...item,
																	language:
																		event.currentTarget.value,
																}
															: item,
													),
												)
											}
										/>
									</Field>
									<Field required>
										<FieldLabel>{t.realms.ruleTitle}</FieldLabel>
										<Input
											required
											maxLength={500}
											value={rule.title}
											onChange={(event) =>
												setDrafts((current) =>
													current?.map((item, itemIndex) =>
														itemIndex === index
															? {
																	...item,
																	title: event.currentTarget
																		.value,
																}
															: item,
													),
												)
											}
										/>
									</Field>
									<Button
										type="button"
										size="sm"
										variant="ghost"
										disabled={drafts.length === 1}
										onClick={() =>
											setDrafts((current) =>
												current?.filter(
													(_, itemIndex) => itemIndex !== index,
												),
											)
										}
									>
										{t.realms.removeRule}
									</Button>
								</div>
								<PortableTextEditor
									label={t.realms.ruleContent}
									value={rule.content}
									onChange={(content) =>
										setDrafts((current) =>
											current?.map((item, itemIndex) =>
												itemIndex === index ? { ...item, content } : item,
											),
										)
									}
								/>
							</div>
						))}
						<div className="flex flex-wrap gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() =>
									setDrafts((current) => [
										...(current ?? []),
										{ language: locale.target, title: "", content: [] },
									])
								}
							>
								{t.realms.addRule}
							</Button>
							<Button type="submit" isLoading={save.isPending}>
								{t.ui.save}
							</Button>
						</div>
						<RequestFailure error={save.error} />
					</form>
				</CardContent>
			</Card>
		</section>
	);
}

function RuleRequirement({
	checked,
	onChange,
	children,
}: {
	checked: boolean;
	onChange: (value: boolean) => void;
	children: string;
}) {
	return (
		<Field className="w-auto" orientation="horizontal">
			<Checkbox
				checked={checked}
				onCheckedChange={({ checked }) => onChange(checked === true)}
			/>
			<FieldLabel className="font-normal">{children}</FieldLabel>
		</Field>
	);
}

function RealmPins({
	realmId,
	pins,
	pending,
	error,
}: {
	realmId: string;
	pins: readonly { unitId: string; kind: string; position: string }[] | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const pin = usePutApiRealmsByRealmIdPinsByUnitId();
	const unpin = useDeleteApiRealmsByRealmIdPinsByUnitId();
	const [target, setTarget] = useState<PickedEntity>();

	function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!target) return;
		const data = new FormData(event.currentTarget);
		const position = String(data.get("position") ?? "").trim();
		pin.mutate(
			{
				path: { realmId, unitId: target.id },
				body: {
					kind: data.get("kind") === "highlight" ? "highlight" : "pinned",
					...(position ? { position } : {}),
				},
			},
			{
				onSuccess: async () => {
					await queryClient.invalidateQueries({
						queryKey: getApiRealmsByRealmIdPinsQueryKey({ path: { realmId } }),
					});
					setTarget(undefined);
				},
			},
		);
	}

	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.realms.pins}</h2>
			<Card>
				<CardContent className="grid gap-4 p-5">
					<form className="grid gap-4" onSubmit={submit}>
						<Field>
							<FieldLabel>{t.realms.pinTarget}</FieldLabel>
							<EntityPicker index="units" value={target} onChange={setTarget} />
						</Field>
						<div className="grid gap-4 sm:grid-cols-2">
							<Field>
								<FieldLabel>{t.realms.pinKind}</FieldLabel>
								<NativeSelect name="kind" defaultValue="pinned">
									<NativeSelectOption value="pinned">pinned</NativeSelectOption>
									<NativeSelectOption value="highlight">
										highlight
									</NativeSelectOption>
								</NativeSelect>
							</Field>
							<Field>
								<FieldLabel>{t.realms.pinPosition}</FieldLabel>
								<Input name="position" maxLength={512} />
							</Field>
						</div>
						<RequestFailure error={pin.error} />
						<Button
							type="submit"
							className="w-fit"
							disabled={!target}
							isLoading={pin.isPending}
						>
							{t.realms.pin}
						</Button>
					</form>
					{pending ? (
						<Skeleton className="h-24 rounded-xl" />
					) : error ? (
						<RequestFailure error={error} />
					) : pins?.length ? (
						<div className="grid gap-2 border-t pt-4">
							{pins.map((item, index) => (
								<div
									key={item.unitId}
									className="flex items-center justify-between gap-3 rounded-lg border p-3 text-sm"
								>
									<div>
										<p className="font-medium">
											{t.realms.pinnedContent} {index + 1}
										</p>
										<p className="text-muted-foreground">
											{t.realms.pinPosition}: {item.position}
										</p>
									</div>
									<Button
										size="sm"
										variant="ghost"
										isLoading={unpin.isPending}
										onClick={() =>
											unpin.mutate(
												{
													path: { realmId, unitId: item.unitId },
													query: {
														kind:
															item.kind === "highlight"
																? "highlight"
																: "pinned",
													},
												},
												{
													onSuccess: () =>
														queryClient.invalidateQueries({
															queryKey:
																getApiRealmsByRealmIdPinsQueryKey({
																	path: { realmId },
																}),
														}),
												},
											)
										}
									>
										{t.realms.unpin}
									</Button>
								</div>
							))}
						</div>
					) : null}
					<RequestFailure error={unpin.error} />
				</CardContent>
			</Card>
		</section>
	);
}

function RealmModeration({
	realmId,
	posts,
	pending,
	error,
}: {
	realmId: string;
	posts: readonly { id: string; title: string | null }[] | undefined;
	pending: boolean;
	error: Parameters<typeof RequestFailure>[0]["error"];
}) {
	const { t } = useTranslation({ suspense: true });
	return (
		<section className="grid gap-3">
			<h2 className="font-heading text-xl font-bold">{t.realms.moderation}</h2>
			{pending ? (
				<Skeleton className="h-48 rounded-xl" />
			) : error ? (
				<RequestFailure error={error} />
			) : posts?.length ? (
				<div className="grid gap-3">
					{posts.map((post) => (
						<RealmModerationRow key={post.id} realmId={realmId} post={post} />
					))}
				</div>
			) : (
				<p className="text-muted-foreground text-sm">{t.state.empty}</p>
			)}
		</section>
	);
}

function RealmModerationRow({
	realmId,
	post,
}: {
	realmId: string;
	post: { id: string; title: string | null };
}) {
	const { t } = useTranslation({ suspense: true });
	const queryClient = useQueryClient();
	const moderate = usePatchApiRealmsByRealmIdUnitsByUnitId();
	function update(
		data:
			| {
					status: (typeof RealmUnitStates)[number];
					locked?: boolean;
			  }
			| { locked: boolean },
	) {
		moderate.mutate(
			{ path: { realmId, unitId: post.id }, body: data },
			{
				onSuccess: () => invalidatePostQueries(queryClient, post.id),
			},
		);
	}
	return (
		<Card>
			<CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-center">
				<p className="font-medium">{post.title ?? t.posts.untitled}</p>
				<div className="flex flex-wrap gap-2">
					{RealmUnitStates.map((status) => (
						<Button
							key={status}
							type="button"
							size="xs"
							variant="outline"
							isLoading={moderate.isPending}
							onClick={() => update({ status })}
						>
							{t.realms.moderationStates[status]}
						</Button>
					))}
					<Button
						type="button"
						size="xs"
						variant="outline"
						onClick={() => update({ locked: true })}
					>
						{t.realms.lock}
					</Button>
					<Button
						type="button"
						size="xs"
						variant="outline"
						onClick={() => update({ locked: false })}
					>
						{t.realms.unlock}
					</Button>
				</div>
				<RequestFailure error={moderate.error} />
			</CardContent>
		</Card>
	);
}

function toMemberRole(value: string): MemberRole {
	return MemberRoles.find((role) => role === value) ?? "member";
}

function toMemberState(value: string): MemberState {
	return MemberStates.find((state) => state === value) ?? "active";
}
