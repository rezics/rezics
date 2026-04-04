import {
  createContext,
  useContext,
  useReducer,
  useMemo,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { flattenTree } from './tree';
import { PluginRegistry } from './registry';
import { folioReducer, DEFAULT_STATE } from './state';
import type {
  FolioState,
  FolioDispatch,
  FolioPosition,
  FolioProgress,
  FolioConfig,
  FlatChapter,
  FolioNode,
  RendererPlugin,
  FolioContent,
} from './types';

// ── Context ─────────────────────────────────────────────────

interface FolioContextValue {
  state: FolioState;
  dispatch: FolioDispatch;
  flatChapters: FlatChapter[];
  registry: PluginRegistry;
  content: FolioContent | null;
  tree: FolioNode[];
}

const FolioContext = createContext<FolioContextValue | null>(null);

export function useFolio(): FolioContextValue {
  const ctx = useContext(FolioContext);
  if (!ctx) {
    throw new Error('useFolio must be used within a <FolioProvider>');
  }
  return ctx;
}

// ── Position Restoration ────────────────────────────────────

function resolveInitialChapterIndex(
  flatChapters: FlatChapter[],
  position?: FolioPosition,
): number {
  if (!position || flatChapters.length === 0) return 0;

  if (position.chapterId) {
    const byId = flatChapters.findIndex(
      (f) => f.node.id === position.chapterId,
    );
    if (byId >= 0) return byId;
  }

  return Math.min(position.chapterIndex, flatChapters.length - 1);
}

// ── Provider ────────────────────────────────────────────────

interface FolioProviderProps {
  tree: FolioNode[];
  plugins: RendererPlugin[];
  initialPosition?: FolioPosition;
  config?: Partial<FolioConfig>;
  onProgressChange?: (progress: FolioProgress) => void;
  onTreeChange?: (tree: FolioNode[]) => void;
  children: ReactNode;
}

export function FolioProvider({
  tree,
  plugins,
  initialPosition,
  config,
  onProgressChange,
  children,
}: FolioProviderProps) {
  const flatChapters = useMemo(() => flattenTree(tree), [tree]);

  const registry = useMemo(() => {
    const reg = new PluginRegistry();
    reg.register(...plugins);
    return reg;
  }, [plugins]);

  const initialChapterIndex = useMemo(
    () => resolveInitialChapterIndex(flatChapters, initialPosition),
    // Only compute on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  const [state, dispatch] = useReducer(folioReducer, {
    ...DEFAULT_STATE,
    chapterIndex: initialChapterIndex,
    pageIndex: initialPosition?.pageIndex ?? 0,
    scrollOffset: initialPosition?.scrollOffset ?? 0,
  });

  // ── Content Loading ─────────────────────────────────────

  const contentCache = useRef<Map<string, FolioContent>>(new Map());
  const [content, setContent] = useState<FolioContent | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prefetchAbortRef = useRef<AbortController | null>(null);

  const currentChapter = flatChapters[state.chapterIndex];
  const prefetchThreshold = config?.prefetchThreshold ?? 2;

  useEffect(() => {
    if (!currentChapter?.node.fetch) return;

    const chapterId = currentChapter.node.id;
    const cached = contentCache.current.get(chapterId);
    if (cached) {
      setContent(cached);
      dispatch({ type: 'SET_STATUS', status: { state: 'ready' } });
      return;
    }

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    dispatch({
      type: 'SET_STATUS',
      status: { state: 'loading', chapterIndex: state.chapterIndex },
    });

    currentChapter.node
      .fetch(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        contentCache.current.set(chapterId, result);
        setContent(result);
        dispatch({ type: 'SET_STATUS', status: { state: 'ready' } });
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        dispatch({
          type: 'SET_STATUS',
          status: {
            state: 'error',
            error: err instanceof Error ? err : new Error(String(err)),
            retry: () =>
              dispatch({
                type: 'SET_CHAPTER',
                index: state.chapterIndex,
              }),
          },
        });
      });

    return () => controller.abort();
  }, [currentChapter, state.chapterIndex]);

  // ── Prefetch ────────────────────────────────────────────

  useEffect(() => {
    if (state.readMode !== 'page') return;
    if (state.pageCount === 0) return;

    const pagesLeft = state.pageCount - 1 - state.pageIndex;
    if (pagesLeft > prefetchThreshold) return;

    const nextChapter = flatChapters[state.chapterIndex + 1];
    if (!nextChapter?.node.fetch) return;

    const nextId = nextChapter.node.id;
    if (contentCache.current.has(nextId)) return;

    prefetchAbortRef.current?.abort();
    const controller = new AbortController();
    prefetchAbortRef.current = controller;

    nextChapter.node
      .fetch(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          contentCache.current.set(nextId, result);
        }
      })
      .catch(() => {
        // Prefetch failures are silent
      });

    return () => controller.abort();
  }, [
    state.readMode,
    state.pageIndex,
    state.pageCount,
    state.chapterIndex,
    flatChapters,
    prefetchThreshold,
  ]);

  // ── Progress Reporting ──────────────────────────────────

  const onProgressChangeRef = useRef(onProgressChange);
  onProgressChangeRef.current = onProgressChange;

  useEffect(() => {
    if (!onProgressChangeRef.current) return;
    if (flatChapters.length === 0) return;

    const chapterFraction =
      state.readMode === 'page' && state.pageCount > 0
        ? state.pageIndex / state.pageCount
        : 0;

    const completedChapters = state.chapterIndex + chapterFraction;
    const fraction = completedChapters / flatChapters.length;

    onProgressChangeRef.current({
      position: {
        chapterIndex: state.chapterIndex,
        chapterId: currentChapter?.node.id,
        pageIndex: state.pageIndex,
        scrollOffset: state.scrollOffset,
      },
      fraction: Math.min(1, Math.max(0, fraction)),
      chapterFraction: Math.min(1, Math.max(0, chapterFraction)),
    });
  }, [
    state.chapterIndex,
    state.pageIndex,
    state.scrollOffset,
    state.pageCount,
    state.readMode,
    flatChapters.length,
    currentChapter,
  ]);

  // ── Context Value ───────────────────────────────────────

  const value = useMemo<FolioContextValue>(
    () => ({
      state,
      dispatch,
      flatChapters,
      registry,
      content,
      tree,
    }),
    [state, dispatch, flatChapters, registry, content, tree],
  );

  return (
    <FolioContext.Provider value={value}>{children}</FolioContext.Provider>
  );
}
