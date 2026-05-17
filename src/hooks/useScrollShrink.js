import { useState, useEffect } from 'react';

export function useScrollShrink(enterThreshold = 100, exitThreshold = 40) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setScrolled(prev => {
        if (!prev && y > enterThreshold) return true;
        if (prev && y < exitThreshold) return false;
        return prev;
      });
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [enterThreshold, exitThreshold]);

  return scrolled;
}
