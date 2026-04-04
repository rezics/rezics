import { useEffect } from 'react';

interface UseKeyboardNavOptions {
  enabled: boolean;
  onNext: () => void;
  onPrev: () => void;
}

export function useKeyboardNav({
  enabled,
  onNext,
  onPrev,
}: UseKeyboardNavOptions) {
  useEffect(() => {
    if (!enabled) return;

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
          e.preventDefault();
          onNext();
          break;
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault();
          onPrev();
          break;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, onNext, onPrev]);
}
