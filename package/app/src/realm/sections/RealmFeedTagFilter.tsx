import type { TagTreeNode } from "@rezics/contract";
import { useLocale } from "@rezics/i18n/react";
import { Button } from "@rezics/ui/shadcn";
import type React from "react";
import { type PointerEvent, useEffect, useMemo, useRef } from "react";
import {
  collectRealmFeedTagChips,
  orderRealmFeedTagChips,
  toggleRealmFeedTagId,
} from "../models/realmFeedTagFilter";
import {
  resolveHorizontalWheelScroll,
  shouldSuppressTagRowClick,
} from "../models/realmFeedTagRowInteraction";

export interface RealmFeedTagFilterProps {
  tagTree?: TagTreeNode[];
  selectedTagIds: string[];
  onChange: (tagIds: string[]) => void;
  onOpenTagsTab: () => void;
}

export const RealmFeedTagFilter: React.FC<RealmFeedTagFilterProps> = ({
  tagTree,
  selectedTagIds,
  onChange,
  onOpenTagsTab,
}) => {
  const locale = useLocale();
  const rowRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    isDown: false,
    isDragging: false,
    pointerId: -1,
    scrollBehavior: "",
    scrollLeft: 0,
    x: 0,
  });
  const suppressClickRef = useRef(false);
  const chips = useMemo(
    () => collectRealmFeedTagChips(tagTree, locale),
    [locale, tagTree],
  );
  const orderedChips = useMemo(
    () => orderRealmFeedTagChips(chips, selectedTagIds),
    [chips, selectedTagIds],
  );
  const selected = useMemo(() => new Set(selectedTagIds), [selectedTagIds]);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    function handleNativeWheel(event: WheelEvent) {
      if (!rowRef.current || event.defaultPrevented) return;

      const element = rowRef.current;
      if (!canScrollHorizontally(element)) {
        return;
      }

      const { nextScrollLeft, preventPageScroll } =
        resolveHorizontalWheelScroll({
          deltaX: event.deltaX,
          deltaY: event.deltaY,
          maxScrollLeft: maxScrollLeft(element),
          scrollLeft: element.scrollLeft,
        });
      if (!preventPageScroll) return;

      setScrollLeftImmediately(element, nextScrollLeft);
      event.preventDefault();
    }

    function handleNativeClick(event: MouseEvent) {
      if (!suppressClickRef.current) return;

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }

    row.addEventListener("wheel", handleNativeWheel, { passive: false });
    row.addEventListener("click", handleNativeClick, true);

    return () => {
      row.removeEventListener("wheel", handleNativeWheel);
      row.removeEventListener("click", handleNativeClick, true);
    };
  }, []);

  if (chips.length === 0) return null;

  const toggle = (tagId: string) => {
    onChange(toggleRealmFeedTagId(selectedTagIds, tagId));
  };

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    suppressClickRef.current = false;
    dragStateRef.current.isDragging = false;

    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      !canScrollHorizontally(event.currentTarget)
    ) {
      return;
    }

    dragStateRef.current = {
      isDown: true,
      isDragging: false,
      pointerId: event.pointerId,
      scrollBehavior: event.currentTarget.style.scrollBehavior,
      scrollLeft: event.currentTarget.scrollLeft,
      x: event.clientX,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    const dragState = dragStateRef.current;
    if (!dragState.isDown || dragState.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - dragState.x;
    if (!dragState.isDragging && !shouldSuppressTagRowClick(deltaX)) return;

    dragState.isDragging = true;
    suppressClickRef.current = true;
    event.currentTarget.style.scrollBehavior = "auto";

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setScrollLeftImmediately(
      event.currentTarget,
      Math.min(
        Math.max(dragState.scrollLeft - deltaX, 0),
        maxScrollLeft(event.currentTarget),
      ),
    );
    event.preventDefault();
  }

  function stopDragging(element: HTMLElement, pointerId: number) {
    const dragState = dragStateRef.current;

    if (
      dragState.pointerId === pointerId &&
      element.hasPointerCapture(pointerId)
    ) {
      element.releasePointerCapture(pointerId);
    }

    dragState.isDown = false;
    dragState.pointerId = -1;
    element.style.scrollBehavior = dragState.scrollBehavior;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    stopDragging(event.currentTarget, event.pointerId);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    stopDragging(event.currentTarget, event.pointerId);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      stopDragging(event.currentTarget, event.pointerId);
    }
  }

  return (
    <div
      ref={rowRef}
      className="scrollbar-hide flex w-full gap-2 overflow-x-auto overscroll-x-contain"
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      {orderedChips.map((chip) => (
        <Button
          key={chip.tagId}
          type="button"
          size="sm"
          variant={selected.has(chip.tagId) ? "default" : "secondary"}
          className="shrink-0"
          aria-pressed={selected.has(chip.tagId)}
          onClick={() => toggle(chip.tagId)}
        >
          {chip.label}
        </Button>
      ))}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="shrink-0"
        onClick={onOpenTagsTab}
      >
        All tags
      </Button>
    </div>
  );
};

function maxScrollLeft(element: HTMLElement) {
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

function canScrollHorizontally(element: HTMLElement) {
  return maxScrollLeft(element) > 0;
}

function setScrollLeftImmediately(element: HTMLElement, scrollLeft: number) {
  const previousScrollBehavior = element.style.scrollBehavior;
  element.style.scrollBehavior = "auto";
  element.scrollLeft = scrollLeft;
  element.style.scrollBehavior = previousScrollBehavior;
}
