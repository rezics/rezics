import {routeStore} from '@/global/routeStore.ts';
import {useEffect, useRef} from 'react';

type StartFn = (cb: (y: number) => void, interval: number) => () => void;

/**
 * 通用滚动恢复：
 * - 按 location 维度记录滚动位置
 * - 如果 routeStore 中没有记录当前 location，则滚动到顶端
 * - 否则滚动到对应的记录位置
 * - 如果 location 上带有 tab 查询参数，使用特殊的滚动调用方式，保证布局稳定后再滚动
 */
export function useScrollRestore(
  location: string,
  startThrottledScroll: StartFn,
  scroll: (y: number) => void,
) {
  const stopThrottledScroll = useRef<null | (() => void)>(null);

  // 监听滚动并按 location 记录 scrollY
  useEffect(() => {
    const routeKey = String(location);

    const timer = globalThis.setTimeout(() => {
      stopThrottledScroll.current = startThrottledScroll(_y => {
        routeStore.getState().setRouteData(routeKey, {
          scrollY: globalThis.pageYOffset,
        });
      }, 200); // 节流间隔
    }, 500); // 延迟启动

    return () => {
      clearTimeout(timer);
      stopThrottledScroll.current?.();
    };
  }, [location, startThrottledScroll]);

  // route 变化时恢复滚动
  useEffect(() => {
    const routeKey = String(location);
    const routeData = routeStore.getState().getRouteData(routeKey);

    // 检查当前 location 上是否有 tab 查询参数
    const hasTabQuery = (() => {
      try {
        const searchIndex = routeKey.indexOf('?');
        if (searchIndex === -1) return false;
        const search = routeKey.slice(searchIndex);
        const params = new URLSearchParams(search);
        return params.has('tab');
      } catch {
        return false;
      }
    })();

    const doScroll = (y: number) => {
      if (hasTabQuery) {
        // 对于带 tab 的场景，等一帧让 Tab 布局稳定后再滚动
        globalThis.setTimeout(() => {
          scroll(y);
        }, 0);
      } else {
        scroll(y);
      }
    };

    // routeStore 中没有记录当前 location，则滚动到顶端
    if (!routeData || typeof routeData.scrollY !== 'number') {
      doScroll(0);
      return;
    }

    // 否则滚动到记录的位置
    doScroll(routeData.scrollY);
  }, [location, scroll]);
}
