import { useEffect, useState } from 'react';

/**
 * False on the first render, true once that render is on screen. Lets a page
 * show at once and add its heavier parts (animations) a moment later.
 */
export function useAfterPaint(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Two frames: the first paints the page, the second runs after it.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setReady(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return ready;
}
