import React, {useEffect, useRef, useState} from 'react';

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
  initTimeoutMs?: number;
  onError?: (error: Error) => void;
  onReady?: () => void;
}

export function Turnstile({
  siteKeyProps,
  onVerify,
  options = {},
  loadingComponent = defaultLoadingComponent(),
  initTimeoutMs = 5000,
  onError,
  onReady,
}: TurnstileProps) {
  const siteKey = siteKeyProps ?? import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [isVerifiedShow, setIsVerifiedShow] = useState(false);

  function handleVerify(token: string) {
    onVerify(token);
  }

  useEffect(() => {
    const scriptId = 'cf-turnstile-script';
    let mounted = true;

    if (!document.getElementById(scriptId)) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.id = scriptId;
      script.crossOrigin = 'anonymous';
      script.onerror = () => {
        if (!mounted) {
          return;
        }
        onError?.(new Error('Failed to load Turnstile widget.'));
      };
      document.body.appendChild(script);
    }

    const interval = setInterval(() => {
      if (window.turnstile && containerRef.current && !widgetIdRef.current) {
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          callback: handleVerify,
          ...options,
        });
        setIsVerifiedShow(true);
        onReady?.();
      }
    }, 100);

    const timeout = window.setTimeout(() => {
      if (!widgetIdRef.current && mounted) {
        onError?.(new Error('Turnstile widget did not initialize in time.'));
      }
    }, initTimeoutMs);

    return () => {
      mounted = false;
      clearInterval(interval);
      clearTimeout(timeout);
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          onError?.(new Error('Error removing Turnstile widget'));
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
