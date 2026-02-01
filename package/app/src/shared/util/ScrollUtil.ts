import throttle from 'lodash/throttle';

type ScrollHandler = (scrollY: number) => void;

/**
 * 开始一个节流滚动监听。
 *
 * @param handle   每次节流后调用的回调，接收当前 window.scrollY
 * @param interval 节流间隔，单位毫秒，默认 200ms
 * @returns        停止监听的函数，调用它会移除监听并取消节流
 */
export function startThrottledScroll(
  handle: ScrollHandler,
  interval: number = 200,
): () => void {
  // 1. 用 lodash 的 throttle 包装回调
  const throttled = throttle(() => {
    // window.scrollY is not defined in the type declaration
    handle(window.scrollY);
  }, interval);

  // 2. 注册滚动事件
  window.addEventListener('scroll', throttled, {passive: true});

  // 3. 返回一个停止监听的函数
  return () => {
    window.removeEventListener('scroll', throttled);
    throttled.cancel(); // 取消任何待执行的节流调用
  };
}

export const scroll = async (distance: number, count = 0) => {
  // After adjusting the page structure, the function worked much better.
  if (count > 1000) {
    return;
  }

  const before = globalThis.pageYOffset;

  globalThis.scrollTo({
    top: distance,
  });

  if (Math.abs(globalThis.pageYOffset - before) > 10) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return scroll(distance, count + 1);
  }
};
