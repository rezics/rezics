/**
 * Trigger a one-shot white-screen transition: create an overlay, then remove it
 * automatically after it fades out.
 * 触发一次白屏过渡：创建遮罩，淡出后自动移除。
 *
 * @param duration Animation duration in milliseconds, default 300。动画时长（毫秒），默认 300。
 */
export function fadeOverlay(duration = 300): void {
  const overlay = document.createElement("div");
  Object.assign(overlay.style, {
    position: "fixed",
    inset: "0",
    backgroundColor: "#fff",
    opacity: "1",
    pointerEvents: "none",
    transition: `opacity ${duration}ms ease-out`,
    zIndex: "9999",
  });
  document.body.appendChild(overlay);

  // Trigger the transition on the next frame.
  // 下一帧触发过渡。
  requestAnimationFrame(() => {
    overlay.style.opacity = "0";
  });

  // Remove the node automatically once the transition completes.
  // 过渡完毕后自动移除节点。
  overlay.addEventListener(
    "transitionend",
    () => {
      overlay.remove();
    },
    { once: true },
  );
}
