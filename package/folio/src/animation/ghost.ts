import type { RefObject } from "react";

export type TurnStyle = "rotate" | "slide" | "fade";

let animating = false;

function getKeyframes(
  style: TurnStyle,
  direction: "next" | "prev",
): Keyframe[] {
  const isNext = direction === "next";

  switch (style) {
    case "rotate":
      return [
        { transform: "rotateY(0deg)", opacity: 1 },
        { transform: `rotateY(${isNext ? -90 : 90}deg)`, opacity: 0 },
      ];
    case "slide":
      return [
        { transform: "translateX(0)" },
        { transform: `translateX(${isNext ? -100 : 100}%)` },
      ];
    case "fade":
      return [
        { opacity: 1, transform: "scale(1)" },
        { opacity: 0, transform: "scale(0.97)" },
      ];
  }
}

function getTransformOrigin(
  style: TurnStyle,
  direction: "next" | "prev",
): string {
  if (style === "rotate") {
    return direction === "next" ? "right center" : "left center";
  }
  return "center center";
}

export async function turnPage(
  containerRef: RefObject<HTMLDivElement | null>,
  innerRef: RefObject<HTMLDivElement | null>,
  direction: "next" | "prev",
  style: TurnStyle,
  onTurn: () => void,
): Promise<void> {
  if (animating) return;

  const container = containerRef.current;
  const inner = innerRef.current;
  if (!container || !inner) return;

  animating = true;

  const rect = container.getBoundingClientRect();

  // ① Clone current viewport as ghost
  // ① 将当前视口克隆为幽灵层
  const ghost = container.cloneNode(true) as HTMLDivElement;
  Object.assign(ghost.style, {
    position: "fixed",
    top: `${rect.top}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    height: `${rect.height}px`,
    pointerEvents: "none",
    zIndex: "9999",
    overflow: "hidden",
    transformOrigin: getTransformOrigin(style, direction),
  });
  document.body.appendChild(ghost);

  // ② Real content jumps instantly
  // ② 真实内容瞬间切换到位
  inner.style.transition = "none";
  onTurn();
  void inner.offsetWidth; // force reflow — 强制重排

  // ③ Ghost animates out via WAAPI
  // ③ 幽灵层通过 WAAPI 动画退场
  const animation = ghost.animate(getKeyframes(style, direction), {
    duration: 320,
    easing: "ease-in",
    fill: "forwards",
  });

  await animation.finished;
  ghost.remove();
  animating = false;
}

export function isAnimating(): boolean {
  return animating;
}
