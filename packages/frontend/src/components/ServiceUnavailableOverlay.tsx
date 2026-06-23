"use client";

import { Duration, Effect, Fiber, Schedule } from "effect";
import { useEffect, useState } from "react";

const retrySchedule = Schedule.exponential("1 second").pipe(
  Schedule.modifyDelay((_, delay) => Effect.succeed(Duration.min(delay, Duration.seconds(30)))),
);

/**
 * Mobile / Tablet / Desktop / Ultra-wide (all identical):
 *
 * +--------------------------------------------------+
 * |                                                  |
 * |            bg-background/60 + blur               |
 * |                                                  |
 * |       "Service temporarily unavailable"          |
 * |                                                  |
 * +--------------------------------------------------+
 *   fixed inset-0 z-9999, flex items-center justify-center
 *
 * 全视口固定遮罩，后端不可达时显示。
 * 使用 Effect Schedule 指数退避重试 /api/health，恢复后自动消失。
 */
export function ServiceUnavailableOverlay() {
  const [isUnavailable, setIsUnavailable] = useState(false);

  useEffect(() => {
    const healthCheck = Effect.tryPromise({
      try: () =>
        fetch("/api/health", { cache: "no-store" }).then((res) => {
          if (!res.ok) throw res;
        }),
      catch: () => "unavailable" as const,
    });

    const monitor = healthCheck.pipe(
      Effect.tapError(() => Effect.sync(() => setIsUnavailable(true))),
      Effect.retry(retrySchedule),
      Effect.tap(() => Effect.sync(() => setIsUnavailable(false))),
      Effect.repeat(Schedule.spaced("30 seconds")),
    );

    const fiber = Effect.runFork(monitor);
    return () => {
      Effect.runFork(Fiber.interrupt(fiber));
    };
  }, []);

  if (!isUnavailable) return null;

  return (
    <div className="bg-background/60 fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md" role="alert">
      <p className="text-foreground text-2xl font-semibold">Service temporarily unavailable</p>
    </div>
  );
}
