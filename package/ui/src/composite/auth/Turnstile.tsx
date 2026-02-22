import React, {useEffect, useRef, useState} from 'react';
import {useAlertStore} from '@app/state/windowAlertStore';

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement | string, config: any) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}

function defaultLoadingComponent() {
  return <div>Loading verification widget...</div>;
}

interface TurnstileProps {
  siteKeyProps?: string;
  onVerify: (token: string) => void;
  options?: Record<string, any>;
  loadingComponent?: React.ReactNode;
}

export function Turnstile({
  siteKeyProps,
  onVerify,
  options = {},
  loadingComponent = defaultLoadingComponent(),
}: TurnstileProps) {
  const siteKey = siteKeyProps ?? import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const {show: showAlert} = useAlertStore();
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isVerifiedShow, setIsVerifiedShow] = useState(false);

  function handleVerify(token: string) {
    onVerify(token);
  }

  useEffect(() => {
    // 1. 动态加载 Turnstile 脚本
    const scriptId = 'cf-turnstile-script';

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.id = scriptId;
      script.crossOrigin = 'anonymous';
      document.body.appendChild(script);
    }

    // 等待 window.turnstile 可用
    const interval = setInterval(() => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleVerify,
          ...options,
        });
        setIsVerifiedShow(true);
      }
    }, 100);

    // cleanup
    return () => {
      clearInterval(interval);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch (error) {
          showAlert('Error removing Turnstile widget');
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <div ref={containerRef} />
      <div>{!isVerifiedShow && loadingComponent}</div>
    </div>
  );
}
