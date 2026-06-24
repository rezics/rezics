import { Tabs as TabsPrimitive } from "@base-ui/react/tabs";
import { cva, type VariantProps } from "class-variance-authority";
import { type PointerEvent, useEffect, useRef } from "react";

import { cn } from "#/shared/lib/utils";

function Tabs({
  className,
  orientation = "horizontal",
  ...props
}: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      className={cn(
        "group/tabs flex gap-2 data-[orientation=horizontal]:flex-col",
        className,
      )}
      {...props}
    />
  );
}

const tabsListVariants = cva(
  "group/tabs-list scrollbar-hide inline-flex w-fit items-center justify-center rounded-full p-1 text-muted-foreground group-data-[orientation=horizontal]/tabs:h-9 group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col group-data-[orientation=vertical]/tabs:rounded-2xl data-[variant=line]:rounded-none",
  {
    variants: {
      variant: {
        default: "bg-muted",
        line: "gap-1 bg-transparent",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function getMaxScrollLeft(element: HTMLElement) {
  return Math.max(0, element.scrollWidth - element.clientWidth);
}

function canScrollHorizontally(element: HTMLElement) {
  return getMaxScrollLeft(element) > 0;
}

function clampScrollLeft(element: HTMLElement, scrollLeft: number) {
  return Math.min(Math.max(scrollLeft, 0), getMaxScrollLeft(element));
}

function setScrollLeftImmediately(element: HTMLElement, scrollLeft: number) {
  const previousScrollBehavior = element.style.scrollBehavior;
  element.style.scrollBehavior = "auto";
  element.scrollLeft = scrollLeft;
  element.style.scrollBehavior = previousScrollBehavior;
}

function TabsList({
  className,
  variant = "default",
  onPointerCancel,
  onPointerDown,
  onPointerLeave,
  onPointerMove,
  onPointerUp,
  ...props
}: TabsPrimitive.List.Props & VariantProps<typeof tabsListVariants>) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef({
    isDown: false,
    isDragging: false,
    pointerId: -1,
    scrollBehavior: "",
    scrollLeft: 0,
    scrollSnapType: "",
    x: 0,
  });
  const suppressClickRef = useRef(false);

  useEffect(() => {
    const element = listRef.current;
    if (!element) {
      return;
    }

    function handleNativeWheel(event: WheelEvent) {
      if (!listRef.current || event.defaultPrevented) {
        return;
      }

      const element = listRef.current;
      if (
        Math.abs(event.deltaX) > Math.abs(event.deltaY) ||
        !canScrollHorizontally(element)
      ) {
        return;
      }

      setScrollLeftImmediately(
        element,
        clampScrollLeft(element, element.scrollLeft + event.deltaY),
      );
      event.preventDefault();
    }

    function handleNativeClick(event: MouseEvent) {
      if (!suppressClickRef.current) {
        return;
      }

      suppressClickRef.current = false;
      event.preventDefault();
      event.stopPropagation();
    }

    element.addEventListener("wheel", handleNativeWheel, { passive: false });
    element.addEventListener("click", handleNativeClick, true);

    return () => {
      element.removeEventListener("wheel", handleNativeWheel);
      element.removeEventListener("click", handleNativeClick, true);
    };
  }, []);

  function handlePointerDown(event: PointerEvent<HTMLDivElement>) {
    onPointerDown?.(event as Parameters<NonNullable<typeof onPointerDown>>[0]);

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
      scrollSnapType: event.currentTarget.style.scrollSnapType,
      x: event.clientX,
    };
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event as Parameters<NonNullable<typeof onPointerMove>>[0]);

    const dragState = dragStateRef.current;
    if (!dragState.isDown || dragState.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragState.x;
    if (!dragState.isDragging && Math.abs(deltaX) < 2) {
      return;
    }

    dragState.isDragging = true;
    suppressClickRef.current = true;
    event.currentTarget.style.scrollBehavior = "auto";
    event.currentTarget.style.scrollSnapType = "none";

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setScrollLeftImmediately(
      event.currentTarget,
      clampScrollLeft(event.currentTarget, dragState.scrollLeft - deltaX),
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
    element.style.scrollSnapType = dragState.scrollSnapType;
  }

  function handlePointerUp(event: PointerEvent<HTMLDivElement>) {
    onPointerUp?.(event as Parameters<NonNullable<typeof onPointerUp>>[0]);
    stopDragging(event.currentTarget, event.pointerId);
  }

  function handlePointerCancel(event: PointerEvent<HTMLDivElement>) {
    onPointerCancel?.(
      event as Parameters<NonNullable<typeof onPointerCancel>>[0],
    );
    stopDragging(event.currentTarget, event.pointerId);
  }

  function handlePointerLeave(event: PointerEvent<HTMLDivElement>) {
    onPointerLeave?.(
      event as Parameters<NonNullable<typeof onPointerLeave>>[0],
    );

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      stopDragging(event.currentTarget, event.pointerId);
    }
  }

  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-variant={variant}
      className={cn(tabsListVariants({ variant }), className)}
      ref={listRef}
      onPointerCancel={handlePointerCancel}
      onPointerDown={handlePointerDown}
      onPointerLeave={handlePointerLeave}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      {...props}
    />
  );
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-2 rounded-full border border-transparent! px-3 py-1 text-sm font-medium whitespace-nowrap text-foreground/60 transition-all group-data-[orientation=vertical]/tabs:w-full group-data-[orientation=vertical]/tabs:justify-start group-data-[orientation=vertical]/tabs:rounded-2xl group-data-[orientation=vertical]/tabs:px-3 group-data-[orientation=vertical]/tabs:py-1.5 hover:text-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-1 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-disabled:pointer-events-none aria-disabled:opacity-50 dark:text-muted-foreground dark:hover:text-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        "group-data-[variant=line]/tabs-list:bg-transparent group-data-[variant=line]/tabs-list:data-active:bg-transparent dark:group-data-[variant=line]/tabs-list:data-active:border-transparent dark:group-data-[variant=line]/tabs-list:data-active:bg-transparent",
        "data-active:bg-background data-active:text-foreground dark:data-active:border-input dark:data-active:bg-input/30 dark:data-active:text-foreground",
        "after:content-empty after:absolute after:bg-foreground after:opacity-0 after:transition-opacity group-data-[orientation=horizontal]/tabs:after:inset-x-0 group-data-[orientation=horizontal]/tabs:after:bottom-[-5px] group-data-[orientation=horizontal]/tabs:after:h-0.5 group-data-[orientation=vertical]/tabs:after:inset-y-0 group-data-[orientation=vertical]/tabs:after:-right-1 group-data-[orientation=vertical]/tabs:after:w-0.5 group-data-[variant=line]/tabs-list:data-active:after:opacity-100",
        className,
      )}
      {...props}
    />
  );
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn("flex-1 text-sm outline-none", className)}
      {...props}
    />
  );
}

export { Tabs, TabsContent, TabsList, TabsTrigger, tabsListVariants };
