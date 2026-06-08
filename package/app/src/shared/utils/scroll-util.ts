import throttle from "lodash/throttle";

type ScrollHandler = (scrollY: number) => void;

/**
 * Start a throttled scroll listener.
 * 开始一个节流滚动监听。
 *
 * @param handle   Callback invoked after each throttle, receives the current window.scrollY。每次节流后调用的回调，接收当前 window.scrollY
 * @param interval Throttle interval in milliseconds, defaults to 200ms。节流间隔，单位毫秒，默认 200ms
 * @returns        A function that stops the listener; calling it removes the listener and cancels the throttle。停止监听的函数，调用它会移除监听并取消节流
 */
export function startThrottledScroll(
  handle: ScrollHandler,
  interval: number = 200,
): () => void {
  // 1. Wrap the callback with lodash's throttle.
  // 1. 用 lodash 的 throttle 包装回调。
  const throttled = throttle(() => {
    // window.scrollY is not defined in the type declaration
    // window.scrollY 未在类型声明中定义
    handle(window.scrollY);
  }, interval);

  // 2. Register the scroll event.
  // 2. 注册滚动事件。
  window.addEventListener("scroll", throttled, { passive: true });

  // 3. Return a function that stops the listener.
  // 3. 返回一个停止监听的函数。
  return () => {
    window.removeEventListener("scroll", throttled);
    throttled.cancel(); // Cancel any pending throttled call — 取消任何待执行的节流调用
  };
}

export const scroll = async (distance: number, count = 0): Promise<void> => {
  // After adjusting the page structure, the function worked much better.
  // 调整页面结构后，该函数的效果好了很多。
  if (count > 1000) {
    return;
  }

  const before = globalThis.pageYOffset;

  globalThis.scrollTo({
    top: distance,
  });

  if (Math.abs(globalThis.pageYOffset - before) > 10) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return scroll(distance, count + 1);
  }
};
