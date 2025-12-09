import {routeStore} from '@/global/routeStore.ts';
import type React from 'react';
import {useEffect, useRef} from 'react';

type StartFn = (cb: (y: number) => void, interval: number) => () => void;

export function useScrollRestore(
  location: string,
  tabRef: React.RefObject<any>,
  startThrottledScroll: StartFn,
  scroll: (y: number) => void,
) {
  const stopThrottledScroll = useRef<null | (() => void)>(null);

  // 挂载/卸载时记录滚动
  useEffect(() => {
    const timer = globalThis.setTimeout(() => {
      stopThrottledScroll.current = startThrottledScroll(_y => {
        routeStore.getState().setRouteData(String(location), {
          scrollY: globalThis.pageYOffset,
          tab: tabRef.current,
        });
      }, 200); // 节流间隔
    }, 500); // 延迟启动

    return () => {
      clearTimeout(timer);
      stopThrottledScroll.current?.();

      // 卸载时保存 tab，但不覆盖 scrollY
      const prev = routeStore.getState().getRouteData(String(location)) || {};
      routeStore.getState().setRouteData(String(location), {
        ...prev,
        tab: tabRef.current,
      });
    };
  }, [location]);

  // When route changes, restore scroll
  useEffect(() => {
    // match specific route
    if (!location.startsWith('/book/')) {
      return;
    }
    const routeData = routeStore.getState().getRouteData(String(location));
    if (routeData?.scrollY) {
      scroll(routeData.scrollY);
      // console.log('restore scroll', routeData.scrollY);
    }
  }, [location]);
}
