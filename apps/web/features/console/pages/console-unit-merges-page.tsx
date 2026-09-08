"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import {
	useListNativeMergeRequests,
	useReadNativeMergeRequest,
} from "@rezics/openapi-tanstack-query";
import type { ListNativeMergeRequestsStatus200 } from "@rezics/openapi-tanstack-query";
import { Badge, Button, QueryFailure, QueryPending } from "@rezics/ui";
import { useTranslation } from "@/i18n/client";
import { DefinitionChoice } from "@/features/catalog-definitions/components/definition-fields";
import { useConsoleWorkspace } from "../components/console-workspace";
import { NativeMergeCreate } from "../components/native-merge-create";
import { NativeMergeDetail } from "../components/native-merge-detail";

type State = ListNativeMergeRequestsStatus200["items"][number]["state"];
const states = [
	"pending_review",
	"accepted",
	"rejected",
	"expired",
	"superseded",
	"executing",
	"action_required",
	"completed",
	"failed",
] as const satisfies readonly State[];

export function ConsoleUnitMergesPage() {
	const { t } = useTranslation(["console", "errors"]);
	const workspace = useConsoleWorkspace();
	const search = useSearchParams();
	const [creating, setCreating] = useState(Boolean(search.get("source")));
	const [state, setState] = useState<State | "all">("pending_review");
	const [cursors, setCursors] = useState<string[]>([]);
	const [selectedId, setSelectedId] = useState(search.get("request") ?? "");
	const requests = useListNativeMergeRequests(
		{ query: { limit: 25, cursor: cursors.at(-1), ...(state === "all" ? {} : { state }) } },
		{ query: { enabled: workspace.canReadUnitMerges } },
	);
	const selected = useReadNativeMergeRequest(
		{ path: { requestId: selectedId } },
		{ query: { enabled: workspace.canReadUnitMerges && Boolean(selectedId) } },
	);
	const changed = () => {
		void requests.refetch();
		if (selectedId) void selected.refetch();
	};
	if (!workspace.canReadUnitMerges) return <p>{t.errors.forbidden}</p>;
	return (
		<section className="mx-auto grid w-full max-w-6xl gap-6">
			<header className="flex flex-wrap justify-between gap-4">
				<h1 className="text-xl font-semibold">{t.console.sections.unitMerges.label}</h1>
				{workspace.canProposeUnitMerges ? (
					<Button aria-expanded={creating} onClick={() => setCreating((value) => !value)}>
						{t.console.unitMerges.newMerge}
					</Button>
				) : null}
			</header>
			{creating && workspace.canProposeUnitMerges ? (
				<NativeMergeCreate
					initialSource={search.get("source") ?? ""}
					onCreated={(id) => {
						setSelectedId(id);
						setCreating(false);
						setState("pending_review");
						setCursors([]);
						void requests.refetch();
					}}
				/>
			) : null}
			<DefinitionChoice
				label={t.console.unitMerges.stateFilter}
				value={state}
				values={["all", ...states]}
				labelFor={(value) =>
					value === "all" ? t.console.unitMerges.allStates : t.console.unitMerges.states[value]
				}
				onChange={(value) => {
					setState(value);
					setCursors([]);
				}}
			/>
			<div className="grid items-start gap-5 lg:grid-cols-[20rem_minmax(0,1fr)]">
				<div className="grid gap-3">
					{requests.isPending ? (
						<QueryPending />
					) : requests.isError ? (
						<QueryFailure error={requests.error} retry={() => void requests.refetch()} />
					) : (
						<>
							{requests.data.items.map((item) => (
								<Button
									key={item.id}
									variant={item.id === selectedId ? "solid" : "outline"}
									className="h-auto justify-start whitespace-normal py-3 text-start"
									onClick={() => setSelectedId(item.id)}
								>
									<span className="grid gap-2">
										<span>
											{item.manifest.sourceUnit.title ?? item.manifest.sourceUnit.id} →{" "}
											{item.manifest.targetUnit.title ?? item.manifest.targetUnit.id}
										</span>
										<Badge>{t.console.unitMerges.states[item.state]}</Badge>
									</span>
								</Button>
							))}
							{!requests.data.items.length ? <p>{t.console.unitMerges.empty}</p> : null}
							<div className="flex gap-2">
								{cursors.length ? (
									<Button
										variant="outline"
										onClick={() => setCursors((value) => value.slice(0, -1))}
									>
										{t.console.nativeMerge.previous}
									</Button>
								) : null}
								{requests.data.nextCursor ? (
									<Button
										variant="outline"
										onClick={() => {
											const next = requests.data.nextCursor;
											if (next) setCursors((value) => [...value, next]);
										}}
									>
										{t.console.unitMerges.loadMore}
									</Button>
								) : null}
							</div>
						</>
					)}
				</div>
				<div className="grid gap-4 rounded-xl border p-5">
					{!selectedId ? (
						<p>{t.console.unitMerges.selectRequest}</p>
					) : selected.isPending ? (
						<QueryPending />
					) : selected.isError ? (
						<QueryFailure error={selected.error} retry={() => void selected.refetch()} />
					) : (
						<NativeMergeDetail key={selected.data.id} request={selected.data} onChanged={changed} />
					)}
				</div>
			</div>
		</section>
	);
}
