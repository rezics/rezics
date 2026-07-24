"use client";

import {
	getApiProgressByUnitIdQueryKey,
	useDeleteApiProgressByUnitId,
	useGetApiProgressByUnitId,
	useGetApiUnitsBookByUnitIdContentStructureNodes,
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
import { hasErrorCode } from "@/i18n/errors";
import { toFiniteApiNumber, toNonNegativeApiInteger } from "@/lib/api-number";
import { useHydratedSession } from "@/lib/use-hydrated-session";
import { invalidateProgressQueries } from "../data/progress-cache";
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

interface ProgressChapter {
	readonly id: string;
	readonly title: string;
}

interface UnitProgressContextValue {
	readonly addToBacklog: () => Promise<boolean>;
	readonly chapters: readonly ProgressChapter[];
	readonly chaptersError: unknown;
	readonly chaptersPending: boolean;
	readonly closeEditor: () => void;
	readonly completeCurrentProgress: (
		update?: Pick<UnitProgressUpdate, "totalTimeMs">,
	) => Promise<boolean>;
	readonly completionError: unknown;
	readonly completionFeedbackCount: number | undefined;
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
}: {
	readonly children: ReactNode;
	readonly domain: UnitProgressDomain;
}) {
	const session = useHydratedSession();
	const authenticated = Boolean(session.data);
	const recordQuery = useGetApiProgressByUnitId(
		{ path: { unitId: domain.unitId } },
		{ query: { enabled: authenticated } },
	);
	const chaptersQuery = useGetApiUnitsBookByUnitIdContentStructureNodes(
		{ path: { unitId: domain.unitId } },
		{ query: { enabled: authenticated && domain.type === "book" } },
	);
	const saveMutation = usePutApiProgressByUnitId();
	const completionMutation = usePostApiProgressByUnitIdComplete();
	const removeMutation = useDeleteApiProgressByUnitId();
	const queryClient = useQueryClient();
	const { t } = useTranslation(["engagement"]);
	const [editorOpen, setEditorOpen] = useState(false);
	const [completionPreview, setCompletionPreview] = useState<UnitProgressRecord>();
	const [completionFeedbackCount, setCompletionFeedbackCount] = useState<number>();
	const completionInFlight = useRef(false);
	const progressQueryKey = useMemo(
		() => getApiProgressByUnitIdQueryKey({ path: { unitId: domain.unitId } }),
		[domain.unitId],
	);
	const recordMissing =
		recordQuery.isError && hasErrorCode(recordQuery.error, "ProgressNotFound");
	const confirmedRecord = useMemo(
		() => (recordQuery.data ? toUnitProgressRecord(recordQuery.data) : null),
		[recordQuery.data],
	);
	const displayedRecord = completionPreview ?? confirmedRecord;
	const state = useMemo(
		() =>
			deriveUnitProgressState({
				authenticated,
				record: displayedRecord,
				recordError: recordQuery.error,
				recordFailed: recordQuery.isError,
				recordMissing,
				recordPending: recordQuery.isPending,
				sessionPending: session.isPending,
			}),
		[
			authenticated,
			displayedRecord,
			recordMissing,
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

	const refreshProgress = useCallback(() => {
		void invalidateProgressQueries(queryClient, domain.unitId).catch(() => undefined);
	}, [domain.unitId, queryClient]);
	const retryProgress = useCallback(() => {
		void recordQuery.refetch();
	}, [recordQuery.refetch]);

	const openEditor = useCallback(() => {
		saveMutation.reset();
		completionMutation.reset();
		removeMutation.reset();
		setEditorOpen(true);
	}, [completionMutation, removeMutation, saveMutation]);

	const closeEditor = useCallback(() => {
		if (saveMutation.isPending || completionInFlight.current || removeMutation.isPending)
			return;
		setEditorOpen(false);
	}, [removeMutation.isPending, saveMutation.isPending]);

	const saveProgress = useCallback(
		async (update: UnitProgressUpdate): Promise<boolean> => {
			try {
				const updated = await saveMutation.mutateAsync({
					path: { unitId: domain.unitId },
					body: update,
				});
				queryClient.setQueryData(progressQueryKey, updated);
				setEditorOpen(false);
				refreshProgress();
				return true;
			} catch {
				return false;
			}
		},
		[domain.unitId, progressQueryKey, queryClient, refreshProgress, saveMutation],
	);

	const completeCurrentProgress = useCallback(
		async (update?: Pick<UnitProgressUpdate, "totalTimeMs">): Promise<boolean> => {
			if (completionInFlight.current) return false;
			completionInFlight.current = true;
			setCompletionFeedbackCount(undefined);
			setCompletionPreview(completeProgressOptimistically(confirmedRecord));
			try {
				const updated = await completionMutation.mutateAsync({
					path: { unitId: domain.unitId },
					body:
						update?.totalTimeMs === undefined
							? {}
							: { totalTimeMs: update.totalTimeMs },
				});
				queryClient.setQueryData(progressQueryKey, updated);
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
			completionMutation,
			confirmedRecord,
			domain.unitId,
			progressQueryKey,
			queryClient,
			refreshProgress,
		],
	);

	const removeProgress = useCallback(async (): Promise<boolean> => {
		try {
			await removeMutation.mutateAsync({ path: { unitId: domain.unitId } });
			setEditorOpen(false);
			setCompletionFeedbackCount(undefined);
			queryClient.removeQueries({ exact: true, queryKey: progressQueryKey });
			refreshProgress();
			return true;
		} catch {
			return false;
		}
	}, [domain.unitId, progressQueryKey, queryClient, refreshProgress, removeMutation]);

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
			chapters: chaptersQuery.data?.items ?? [],
			chaptersError: chaptersQuery.error,
			chaptersPending: chaptersQuery.isPending,
			closeEditor,
			completeCurrentProgress,
			completionError: completionMutation.error,
			completionFeedbackCount,
			domain,
			editorOpen,
			isCompleting: completionPreview !== undefined,
			isRemoving: removeMutation.isPending,
			isSaving: saveMutation.isPending,
			openEditor,
			removeError: removeMutation.error,
			removeProgress,
			resumeProgress,
			retryProgress,
			saveError: saveMutation.error,
			saveProgress,
			startAgain,
			state,
		}),
		[
			addToBacklog,
			chaptersQuery.data?.items,
			chaptersQuery.error,
			chaptersQuery.isPending,
			closeEditor,
			completeCurrentProgress,
			completionFeedbackCount,
			completionMutation.error,
			completionPreview,
			domain,
			editorOpen,
			openEditor,
			removeMutation.error,
			removeMutation.isPending,
			removeProgress,
			resumeProgress,
			retryProgress,
			saveMutation.error,
			saveMutation.isPending,
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
}): UnitProgressRecord {
	return {
		completedCount: toNonNegativeApiInteger(value.completedCount),
		lastContentStructureNodeId: value.lastContentStructureNodeId,
		progress: clampProgress(value.progress),
		status: toProgressStatus(value.status),
		totalTimeMs: Math.max(0, toFiniteApiNumber(value.totalTimeMs) ?? 0),
	};
}
