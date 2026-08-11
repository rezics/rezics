"use client";

import {
	getApiProgressByUnitIdQueryKey,
	type GetApiProgressByUnitIdStatus200,
	useDeleteApiProgressByUnitId,
	useGetApiProgressByUnitId,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
	useGetApiUnitsMediaByUnitIdContentStructureNodes,
	usePostApiProgressByUnitIdComplete,
	usePutApiProgressByUnitId,
} from "@rezics/openapi-tanstack-query";
import { useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
	type ReactNode,
} from "react";

import { useTranslation } from "@/i18n/client";
import { isResourceVisibility } from "@/features/privacy/model/resource-visibility";
import { useLocalizationLanguages } from "@/i18n/use-localization-languages";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateProgressQueries } from "../data/progress-cache";
import { estimateBookChapterProgresses } from "../model/book-progress-estimate";
import { estimateMediaItemProgresses } from "../model/media-progress-estimate";
import {
	clampProgress,
	completeProgressOptimistically,
	createBacklogUpdate,
	createRereadUpdate,
	createResumeUpdate,
	toProgressStatus,
	type UnitProgressDomain,
	type UnitProgressRecord,
	type UnitProgressUpdate,
} from "../model/progress-record";
import { deriveUnitProgressState, type UnitProgressState } from "../model/progress-state";

interface ProgressContentStructureNode {
	readonly estimatedPercentage: number;
	readonly id: string;
	readonly title: string;
}

const EmptyContentStructureNodes: readonly ProgressContentStructureNode[] = [];

interface UnitProgressContextValue {
	readonly addToBacklog: () => Promise<boolean>;
	readonly closeEditor: () => void;
	readonly completeCurrentProgress: (
		update?: Pick<UnitProgressUpdate, "totalTimeMs" | "visibility">,
	) => Promise<boolean>;
	readonly completionError: unknown;
	readonly completionFeedbackCount: number | undefined;
	readonly contentStructureNodes: readonly ProgressContentStructureNode[];
	readonly contentStructureNodesError: unknown;
	readonly contentStructureNodesPending: boolean;
	readonly currentEntryId: string | null;
	readonly domain: UnitProgressDomain;
	readonly editorOpen: boolean;
	readonly isCompleting: boolean;
	readonly isRemoving: boolean;
	readonly isSaving: boolean;
	readonly openEditor: () => void;
	readonly removeError: unknown;
	readonly removeProgress: () => Promise<boolean>;
	readonly resumeProgress: () => Promise<boolean>;
	readonly retryProgress: () => void;
	readonly saveError: unknown;
	readonly saveProgress: (update: UnitProgressUpdate) => Promise<boolean>;
	readonly startAgain: () => Promise<boolean>;
	readonly state: UnitProgressState;
}

const UnitProgressContext = createContext<UnitProgressContextValue | undefined>(undefined);

export function useUnitProgress(): UnitProgressContextValue {
	const value = useContext(UnitProgressContext);
	if (!value) throw new Error("Unit progress must be rendered inside UnitProgressProvider");
	return value;
}

export function UnitProgressProvider({
	children,
	domain,
	initialEditorOpen = false,
	onEditorClosed,
}: {
	readonly children: ReactNode;
	readonly domain: UnitProgressDomain;
	/** Whether the editor is open on this provider's initial render. */
	readonly initialEditorOpen?: boolean;
	readonly onEditorClosed?: () => void;
}) {
	const session = useHydratedSession();
	const authenticated = Boolean(session.data);
	const localizationLanguages = useLocalizationLanguages();
	const recordQuery = useGetApiProgressByUnitId(
		{ path: { unitId: domain.unitId } },
		{ query: { enabled: authenticated } },
	);
	const chaptersQuery = useGetApiUnitsBookByUnitIdContentStructureNodes(
		{ path: { unitId: domain.unitId }, query: { localizationLanguages } },
		{ query: { enabled: authenticated && domain.type === "book" } },
	);
	const mediaItemsQuery = useGetApiUnitsMediaByUnitIdContentStructureNodes(
		{ path: { unitId: domain.unitId }, query: { localizationLanguages } },
		{ query: { enabled: authenticated && domain.type === "media" } },
	);
	const {
		error: saveError,
		isPending: isSaving,
		mutateAsync: saveProgressRequest,
		reset: resetSaveProgress,
	} = usePutApiProgressByUnitId();
	const {
		error: completionError,
		mutateAsync: completeProgressRequest,
		reset: resetCompletion,
	} = usePostApiProgressByUnitIdComplete();
	const {
		error: removeError,
		isPending: isRemoving,
		mutateAsync: removeProgressRequest,
		reset: resetRemoveProgress,
	} = useDeleteApiProgressByUnitId();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["engagement"]);
	const [editorOpen, setEditorOpen] = useState(initialEditorOpen);
	const [completionPreview, setCompletionPreview] = useState<UnitProgressRecord>();
	const [completionFeedbackCount, setCompletionFeedbackCount] = useState<number>();
	const completionInFlight = useRef(false);
	const editorWasOpen = useRef(false);
	const progressQueryKey = useMemo(
		() => getApiProgressByUnitIdQueryKey({ path: { unitId: domain.unitId } }),
		[domain.unitId],
	);
	const confirmedRecord = useMemo(
		() =>
			recordQuery.data?.state === "tracked" ? toUnitProgressRecord(recordQuery.data.record) : null,
		[recordQuery.data],
	);
	const currentEntryId =
		recordQuery.data?.state === "tracked" ? recordQuery.data.record.currentEntryId : null;
	const chapters = useMemo(() => {
		const nodes = chaptersQuery.data?.items ?? [];
		const titleById = new Map(nodes.map((node) => [node.id, node.title]));
		return estimateBookChapterProgresses(nodes).flatMap((estimate) => {
			const title = titleById.get(estimate.id);
			return title !== undefined
				? [
						{
							id: estimate.id,
							title,
							estimatedPercentage: estimate.percentage,
						},
					]
				: [];
		});
	}, [chaptersQuery.data?.items]);
	const mediaItems = useMemo(() => {
		const nodes = mediaItemsQuery.data?.items ?? [];
		const titleById = new Map(nodes.map((node) => [node.id, node.title]));
		return estimateMediaItemProgresses(nodes).flatMap((estimate) => {
			const title = titleById.get(estimate.id);
			return title !== undefined
				? [
						{
							id: estimate.id,
							title,
							estimatedPercentage: estimate.percentage,
						},
					]
				: [];
		});
	}, [mediaItemsQuery.data?.items]);
	const contentStructureNodes =
		domain.type === "book"
			? chapters
			: domain.type === "media"
				? mediaItems
				: EmptyContentStructureNodes;
	const contentStructureNodesError =
		domain.type === "book"
			? chaptersQuery.error
			: domain.type === "media"
				? mediaItemsQuery.error
				: undefined;
	const contentStructureNodesPending =
		domain.type === "book"
			? chaptersQuery.isPending
			: domain.type === "media"
				? mediaItemsQuery.isPending
				: false;
	const displayedRecord = completionPreview ?? confirmedRecord;
	const state = useMemo(
		() =>
			deriveUnitProgressState({
				authenticated,
				record: displayedRecord,
				recordError: recordQuery.error,
				recordFailed: recordQuery.isError,
				recordPending: recordQuery.isPending,
				sessionPending: session.isPending,
			}),
		[
			authenticated,
			displayedRecord,
			recordQuery.error,
			recordQuery.isError,
			recordQuery.isPending,
			session.isPending,
		],
	);

	useEffect(() => {
		if (completionFeedbackCount === undefined) return;
		const timer = window.setTimeout(() => setCompletionFeedbackCount(undefined), 1_600);
		return () => window.clearTimeout(timer);
	}, [completionFeedbackCount]);

	useEffect(() => {
		if (editorOpen) {
			editorWasOpen.current = true;
			return;
		}
		if (!editorWasOpen.current) return;
		editorWasOpen.current = false;
		onEditorClosed?.();
	}, [editorOpen, onEditorClosed]);

	const refreshProgress = useCallback(() => {
		void invalidateProgressQueries(queryClient, domain.unitId).catch(() => undefined);
	}, [domain.unitId, queryClient]);
	const retryProgress = useCallback(() => {
		void recordQuery.refetch();
	}, [recordQuery.refetch]);

	const openEditor = useCallback(() => {
		resetSaveProgress();
		resetCompletion();
		resetRemoveProgress();
		setEditorOpen(true);
	}, [resetCompletion, resetRemoveProgress, resetSaveProgress]);

	const closeEditor = useCallback(() => {
		if (isSaving || completionInFlight.current || isRemoving) return;
		setEditorOpen(false);
	}, [isRemoving, isSaving]);

	const saveProgress = useCallback(
		async (update: UnitProgressUpdate): Promise<boolean> => {
			try {
				const updated = await saveProgressRequest({
					path: { unitId: domain.unitId },
					body: update,
				});
				queryClient.setQueryData(progressQueryKey, {
					state: "tracked",
					record: updated,
				} satisfies GetApiProgressByUnitIdStatus200);
				setEditorOpen(false);
				refreshProgress();
				return true;
			} catch {
				return false;
			}
		},
		[domain.unitId, progressQueryKey, queryClient, refreshProgress, saveProgressRequest],
	);

	const completeCurrentProgress = useCallback(
		async (update?: Pick<UnitProgressUpdate, "totalTimeMs" | "visibility">): Promise<boolean> => {
			if (completionInFlight.current) return false;
			completionInFlight.current = true;
			setCompletionFeedbackCount(undefined);
			setCompletionPreview(completeProgressOptimistically(confirmedRecord));
			try {
				const updated = await completeProgressRequest({
					path: { unitId: domain.unitId },
					body: {
						...(update?.totalTimeMs === undefined ? {} : { totalTimeMs: update.totalTimeMs }),
						...(update?.visibility === undefined ? {} : { visibility: update.visibility }),
					},
				});
				queryClient.setQueryData(progressQueryKey, {
					state: "tracked",
					record: updated,
				} satisfies GetApiProgressByUnitIdStatus200);
				setCompletionFeedbackCount(toNonNegativeApiInteger(updated.completedCount));
				setEditorOpen(false);
				refreshProgress();
				return true;
			} catch {
				return false;
			} finally {
				completionInFlight.current = false;
				setCompletionPreview(undefined);
			}
		},
		[
			completeProgressRequest,
			confirmedRecord,
			domain.unitId,
			progressQueryKey,
			queryClient,
			refreshProgress,
		],
	);

	const removeProgress = useCallback(async (): Promise<boolean> => {
		try {
			await removeProgressRequest({ path: { unitId: domain.unitId } });
			setEditorOpen(false);
			setCompletionFeedbackCount(undefined);
			queryClient.setQueryData(progressQueryKey, {
				state: "untracked",
			} satisfies GetApiProgressByUnitIdStatus200);
			refreshProgress();
			return true;
		} catch {
			return false;
		}
	}, [domain.unitId, progressQueryKey, queryClient, refreshProgress, removeProgressRequest]);

	const startAgain = useCallback(
		() => saveProgress(createRereadUpdate(domain.type)),
		[domain.type, saveProgress],
	);
	const addToBacklog = useCallback(
		() => saveProgress(createBacklogUpdate(domain.type)),
		[domain.type, saveProgress],
	);
	const resumeProgress = useCallback(
		() =>
			confirmedRecord
				? saveProgress(createResumeUpdate(domain.type, confirmedRecord))
				: Promise.resolve(false),
		[confirmedRecord, domain.type, saveProgress],
	);

	const value = useMemo<UnitProgressContextValue>(
		() => ({
			addToBacklog,
			closeEditor,
			completeCurrentProgress,
			completionError,
			completionFeedbackCount,
			contentStructureNodes,
			contentStructureNodesError,
			contentStructureNodesPending,
			currentEntryId,
			domain,
			editorOpen,
			isCompleting: completionPreview !== undefined,
			isRemoving,
			isSaving,
			openEditor,
			removeError,
			removeProgress,
			resumeProgress,
			retryProgress,
			saveError,
			saveProgress,
			startAgain,
			state,
		}),
		[
			addToBacklog,
			closeEditor,
			completeCurrentProgress,
			completionError,
			completionFeedbackCount,
			completionPreview,
			contentStructureNodes,
			contentStructureNodesError,
			contentStructureNodesPending,
			currentEntryId,
			domain,
			editorOpen,
			isRemoving,
			isSaving,
			openEditor,
			removeError,
			removeProgress,
			resumeProgress,
			retryProgress,
			saveError,
			saveProgress,
			startAgain,
			state,
		],
	);

	return (
		<UnitProgressContext.Provider value={value}>
			{children}
			<span aria-live="polite" className="sr-only" role="status">
				{completionFeedbackCount === undefined
					? ""
					: t.engagement.progressByType[domain.type].completedFeedback({
							count: completionFeedbackCount,
						})}
			</span>
		</UnitProgressContext.Provider>
	);
}

function toUnitProgressRecord(value: {
	readonly completedCount: number | string;
	readonly lastContentStructureNodeId: string | null;
	readonly progress: number;
	readonly status: string;
	readonly totalTimeMs: number | string;
	readonly visibility: string;
}): UnitProgressRecord {
	return {
		completedCount: toNonNegativeApiInteger(value.completedCount),
		lastContentStructureNodeId: value.lastContentStructureNodeId,
		progress: clampProgress(value.progress),
		status: toProgressStatus(value.status),
		totalTimeMs: Math.max(0, toFiniteApiNumber(value.totalTimeMs) ?? 0),
		visibility: isResourceVisibility(value.visibility) ? value.visibility : "private",
	};
}
