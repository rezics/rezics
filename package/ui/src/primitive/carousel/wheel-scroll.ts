export type CarouselWheelScrollAxis = "x" | "y";

export type CarouselWheelScrollResolution = {
  consume: boolean;
  distance: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function wheelDeltaForAxis({
  axis,
  deltaX,
  deltaY,
}: {
  axis: CarouselWheelScrollAxis;
  deltaX: number;
  deltaY: number;
}) {
  if (axis === "y") return deltaY;
  return Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
}

export function resolveCarouselWheelScroll({
  axis,
  deltaX,
  deltaY,
  directionSign = 1,
  loop = false,
  max,
  min,
  target,
}: {
  axis: CarouselWheelScrollAxis;
  deltaX: number;
  deltaY: number;
  directionSign?: number;
  loop?: boolean;
  max: number;
  min: number;
  target: number;
}): CarouselWheelScrollResolution {
  const delta = wheelDeltaForAxis({ axis, deltaX, deltaY });
  if (delta === 0) return { consume: false, distance: 0 };

  const distance = directionSign * -delta;
  if (loop) return { consume: true, distance };

  const nextTarget = clamp(target + distance, min, max);
  const boundedDistance = nextTarget - target;
  return {
    consume: boundedDistance !== 0,
    distance: boundedDistance,
  };
}
