import { useCallback, useRef } from 'react';
import { useGesture } from '@use-gesture/react';
import { turnPage, isAnimating } from '../animation/ghost';
import { useFolio } from '../context';

interface UseFolioGestureOptions {
  containerRef: React.RefObject<HTMLDivElement | null>;
  innerRef: React.RefObject<HTMLDivElement | null>;
  onToggleUI: () => void;
}

export function useFolioGesture({
  containerRef,
  innerRef,
  onToggleUI,
}: UseFolioGestureOptions) {
  const { state, dispatch, flatChapters } = useFolio();
  const gestureRef = useRef<HTMLDivElement>(null);

  const canGoNext =
    state.pageIndex < state.pageCount - 1 ||
    state.chapterIndex < flatChapters.length - 1;

  const canGoPrev =
    state.pageIndex > 0 || state.chapterIndex > 0;

  const navigate = useCallback(
    (direction: 'next' | 'prev') => {
      if (isAnimating()) return;
      if (direction === 'next' && !canGoNext) return;
      if (direction === 'prev' && !canGoPrev) return;

      turnPage(containerRef, innerRef, direction, state.turnStyle, () => {
        if (direction === 'next') {
          if (state.pageIndex < state.pageCount - 1) {
            dispatch({ type: 'SET_PAGE', index: state.pageIndex + 1 });
          } else if (state.chapterIndex < flatChapters.length - 1) {
            dispatch({
              type: 'SET_CHAPTER',
              index: state.chapterIndex + 1,
            });
          }
        } else {
          if (state.pageIndex > 0) {
            dispatch({ type: 'SET_PAGE', index: state.pageIndex - 1 });
          } else if (state.chapterIndex > 0) {
            dispatch({
              type: 'SET_CHAPTER',
              index: state.chapterIndex - 1,
            });
            // Will need to set to last page after content loads
          }
        }
      });
    },
    [
      containerRef,
      innerRef,
      state.turnStyle,
      state.pageIndex,
      state.pageCount,
      state.chapterIndex,
      flatChapters.length,
      canGoNext,
      canGoPrev,
      dispatch,
    ],
  );

  const bind = useGesture(
    {
      onDrag: ({ swipe: [swipeX] }) => {
        if (state.readMode !== 'page') return;
        if (swipeX === -1) navigate('next');
        if (swipeX === 1) navigate('prev');
      },
      onClick: ({ event }) => {
        if (state.readMode !== 'page') return;
        const x = (event as MouseEvent).clientX;
        const w = window.innerWidth;
        if (x < w * 0.3) navigate('prev');
        else if (x > w * 0.7) navigate('next');
        else onToggleUI();
      },
    },
    {
      drag: {
        filterTaps: true,
        axis: 'x',
      },
    },
  );

  return { bind, gestureRef, navigate };
}
