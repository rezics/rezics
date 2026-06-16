export type HorizontalWheelScroll = {
  nextScrollLeft: number;
  preventPageScroll: boolean;
};

export const REALM_STREAM_TAG_DRAG_THRESHOLD_PX = 2;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function resolveHorizontalWheelScroll({
  deltaX,
  deltaY,
  maxScrollLeft,
  scrollLeft,
}: {
  deltaX: number;
  deltaY: number;
  maxScrollLeft: number;
  scrollLeft: number;
}): HorizontalWheelScroll {
  if (Math.abs(deltaX) > Math.abs(deltaY) || maxScrollLeft <= 0) {
    return { nextScrollLeft: scrollLeft, preventPageScroll: false };
  }

  const nextScrollLeft = clamp(scrollLeft + deltaY, 0, maxScrollLeft);
  return {
    nextScrollLeft,
    preventPageScroll: nextScrollLeft !== scrollLeft,
  };
}

export function shouldSuppressTagRowClick(
  deltaX: number,
  threshold = REALM_STREAM_TAG_DRAG_THRESHOLD_PX,
) {
  return Math.abs(deltaX) >= threshold;
}
